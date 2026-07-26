import os
import json
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
from functools import wraps
from pymongo import MongoClient

app = Flask(__name__, static_folder='static', template_folder='.')
CORS(app)

MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URI)
db = client.get_default_database(default='offtake_db')
master_col = db.master_data
submissions_col = db.submissions

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'password123'

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_pass = request.headers.get('X-Admin-Key')
        if auth_pass != ADMIN_PASSWORD:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

import math

def clean_nan(obj):
    if isinstance(obj, float) and math.isnan(obj):
        return None
    elif isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan(i) for i in obj]
    return obj

def get_master_data_json():
    try:
        data = list(master_col.find({}, {'_id': False}))
        data = clean_nan(data)
        return json.dumps(data)
    except Exception as e:
        print("Error reading from MongoDB:", e)
        return "[]"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if data.get('username') == ADMIN_USERNAME and data.get('password') == ADMIN_PASSWORD:
        return jsonify({"status": "success", "token": ADMIN_PASSWORD})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/data', methods=['GET'])
def get_data():
    return app.response_class(response=get_master_data_json(), status=200, mimetype='application/json')

@app.route('/api/submit', methods=['POST'])
def submit():
    submission = request.json
    try:
        submissions_col.insert_one(submission)
        return jsonify({"status": "success", "message": "Data saved!"})
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/download', methods=['GET'])
@require_admin
def download():
    submissions = list(submissions_col.find({}, {'_id': False}))
    if not submissions:
        return "No submissions yet.", 404
        
    rows = []
    for sub in submissions:
        base_info = {
            "Distributor": sub.get("distributor"),
            "DSR": sub.get("dsr"),
            "Beat Area": sub.get("beat_area"),
            "Retailer": sub.get("retailer")
        }
        for prod in sub.get("products", []):
            row = base_info.copy()
            row["Product"] = prod.get("parent_material_desc")
            row["SKU"] = prod.get("club_sku")
            row["Closing Stock"] = prod.get("closing_stock")
            rows.append(row)
            
    if not rows:
        return "No submission data found.", 404

    df = pd.DataFrame(rows)
    export_path = os.path.join(DATA_DIR, 'export.xlsx')
    df.to_excel(export_path, index=False)
    
    return send_file(export_path, as_attachment=True, download_name='closing_stock_submissions.xlsx')

@app.route('/api/admin/download_master', methods=['GET'])
@require_admin
def download_master():
    data = list(master_col.find({}, {'_id': False}))
    if not data:
        return "Master file is empty.", 404
    
    df = pd.DataFrame(data)
    export_path = os.path.join(DATA_DIR, 'export_master.xlsx')
    df.to_excel(export_path, index=False)
    
    return send_file(export_path, as_attachment=True, download_name='updated_master_data.xlsx')

@app.route('/api/admin/entity', methods=['POST'])
@require_admin
def add_entity():
    data = request.json
    entity_type = data.get('type')
    name = data.get('name', '').strip()
    parent = data.get('parent', '').strip()
    
    if not name or not entity_type:
        return jsonify({"error": "Missing entity type or name."}), 400
        
    try:
        current_data = list(master_col.find({}, {'_id': False}))
        if not current_data:
            df = pd.DataFrame()
        else:
            df = pd.DataFrame(current_data)
            
        new_row = {col: None for col in df.columns}
        
        if entity_type == 'distributor':
            new_row['Distributor Name'] = name
        elif entity_type == 'dsr':
            if not parent:
                return jsonify({"error": "Distributor selection required for adding DSR."}), 400
            if not df.empty:
                parent_matches = df[df['Distributor Name'] == parent]
                if not parent_matches.empty:
                    ref = parent_matches.iloc[0]
                    for col in ['HQ Name', 'distributor_code', 'Distributor Name']:
                        if col in df.columns:
                            new_row[col] = ref.get(col)
                else:
                    new_row['Distributor Name'] = parent
            else:
                new_row['Distributor Name'] = parent
            new_row['DSR Name'] = name
        elif entity_type == 'beat':
            if not parent:
                return jsonify({"error": "DSR selection required for adding Beat Area."}), 400
            if not df.empty:
                parent_matches = df[df['DSR Name'] == parent]
                if not parent_matches.empty:
                    ref = parent_matches.iloc[0]
                    for col in ['HQ Name', 'distributor_code', 'Distributor Name', 'SM Position code', 'DSR Name', 'Beat Day']:
                        if col in df.columns:
                            new_row[col] = ref.get(col)
                else:
                    new_row['DSR Name'] = parent
            else:
                new_row['DSR Name'] = parent
            new_row['beat_name'] = name
        elif entity_type == 'retailer':
            if not parent:
                return jsonify({"error": "Beat Area selection required for adding Retailer."}), 400
            if not df.empty:
                parent_matches = df[df['beat_name'] == parent]
                if not parent_matches.empty:
                    ref = parent_matches.iloc[0]
                    for col in ['HQ Name', 'distributor_code', 'Distributor Name', 'SM Position code', 'DSR Name', 'beat_name', 'Beat Day']:
                        if col in df.columns:
                            new_row[col] = ref.get(col)
                else:
                    new_row['beat_name'] = parent
            else:
                new_row['beat_name'] = parent
            new_row['retailer_name'] = name
        elif entity_type == 'store_product':
            if not parent:
                return jsonify({"error": "Store (Retailer) selection required for adding a product."}), 400
            if not df.empty:
                parent_matches = df[df['retailer_name'] == parent]
                if not parent_matches.empty:
                    ref = parent_matches.iloc[0]
                    for col in ['HQ Name', 'distributor_code', 'Distributor Name', 'SM Position code', 'DSR Name', 'beat_name', 'Beat Day', 'cmp_parent_retailer_code', 'retailer_name']:
                        if col in df.columns:
                            new_row[col] = ref.get(col)
                else:
                    new_row['retailer_name'] = parent
            else:
                new_row['retailer_name'] = parent
            new_row['parent_material_desc'] = name
            new_row['club_sku'] = data.get('sku', '').strip() or 'N/A'
            try:
                amt = float(data.get('amount', 0))
            except:
                amt = 0
            
            month = data.get('month', 'Total')
            year = data.get('year', '').strip()
            if year:
                new_row['Year'] = year
            
            # Initialize all standard columns to 0 for this new record
            all_months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            for m in all_months + ['Total']:
                if m not in df.columns:
                    df[m] = 0
                new_row[m] = 0
                
            if month in all_months:
                new_row[month] = amt
                new_row['Total'] = amt
            else:
                new_row['Total'] = amt
        else:
            return jsonify({"error": "Invalid entity type."}), 400
            
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        
        # Save back to MongoDB
        df = df.replace({np.nan: None})
        master_col.delete_many({})
        records = df.to_dict('records')
        if records:
            master_col.insert_many(records)
            
        return jsonify({"status": "success", "message": f"{entity_type.replace('_', ' ').upper()} '{name}' added successfully!"})
    except Exception as e:
        print("Error adding entity:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/entity', methods=['DELETE'])
@require_admin
def delete_entity():
    data = request.json
    entity_type = data.get('type')
    name = data.get('name')
    parent = data.get('parent')
    
    if not name or not entity_type:
        return jsonify({"error": "Missing entity type or name."}), 400
        
    try:
        current_data = list(master_col.find({}, {'_id': False}))
        if not current_data:
            return jsonify({"error": "Master data is empty."}), 404
            
        df = pd.DataFrame(current_data)
        
        if entity_type == 'store_product':
            if parent:
                df = df[~((df['parent_material_desc'] == name) & (df['retailer_name'] == parent))]
            else:
                df = df[df['parent_material_desc'] != name]
        else:
            col_map = {
                'distributor': 'Distributor Name',
                'dsr': 'DSR Name',
                'beat': 'beat_name',
                'retailer': 'retailer_name'
            }
            
            target_col = col_map.get(entity_type)
            if not target_col:
                return jsonify({"error": "Invalid entity type."}), 400
                
            if target_col in df.columns:
                df = df[df[target_col] != name]
                
        # Save back to MongoDB
        df = df.replace({np.nan: None})
        master_col.delete_many({})
        records = df.to_dict('records')
        if records:
            master_col.insert_many(records)
            
        return jsonify({"status": "success", "message": f"{entity_type.upper()} '{name}' deleted successfully!"})
    except Exception as e:
        print("Error deleting entity:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/upload_master', methods=['POST'])
@require_admin
def upload_master():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected for uploading"}), 400
        
    if file and file.filename.endswith('.xlsx'):
        try:
            df = pd.read_excel(file)
            df = df.replace({np.nan: None})
            records = df.to_dict('records')
            
            master_col.delete_many({})
            if records:
                master_col.insert_many(records)
                
            return jsonify({"status": "success", "message": "Master data uploaded to MongoDB successfully!"})
        except Exception as e:
            print("Error uploading master data:", e)
            return jsonify({"error": "Failed to parse or save the uploaded Excel file. Ensure it is a valid .xlsx file."}), 500
    else:
        return jsonify({"error": "Allowed file type is .xlsx"}), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
