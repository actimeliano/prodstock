from flask import Flask, request, jsonify, render_template
from replit.object_storage import Client
import json
from collections import defaultdict
import uuid

app = Flask(__name__)
client = Client()

# Helper functions to handle storage
def load_data(filename):
    try:
        data = client.download_as_text(filename)
        return json.loads(data)
    except:
        return {}

def save_data(filename, data):
    client.upload_from_text(filename, json.dumps(data))

# Load initial data
places = load_data("places.json")
products = load_data("products.json")
allocations = load_data("allocations.json")

@app.route('/')
def index():
    return render_template('index.html')

# Places routes
@app.route('/places', methods=['GET', 'POST'])
def manage_places():
    if request.method == 'POST':
        place_name = request.form['name']
        place_id = str(uuid.uuid4())
        places[place_id] = {'name': place_name, 'products': []}
        save_data("places.json", places)
        return jsonify({'message': 'Place added', 'places': places})
    return jsonify(places)

@app.route('/places/<place_id>', methods=['DELETE'])
def delete_place(place_id):
    if place_id in places:
        del places[place_id]
        save_data("places.json", places)
        return jsonify({'message': 'Place deleted', 'places': places})
    return jsonify({'message': 'Place not found'}), 404

# Products routes
@app.route('/products', methods=['GET', 'POST'])
def manage_products():
    if request.method == 'POST':
        product_name = request.form['name']
        quantity = int(request.form['quantity'])
        ideal_quantity = int(request.form['ideal_quantity'])
        
        # Check if product already exists
        existing_product = next((id for id, prod in products.items() if prod['name'] == product_name), None)
        
        if existing_product:
            # Update existing product
            products[existing_product]['quantity'] = quantity
            products[existing_product]['ideal_quantity'] = ideal_quantity
        else:
            # Add new product
            product_id = str(uuid.uuid4())
            products[product_id] = {
                'name': product_name,
                'quantity': quantity,
                'ideal_quantity': ideal_quantity,
            }
        
        save_data("products.json", products)
        return jsonify({'message': 'Product added/updated', 'products': products})
    return jsonify(products)

@app.route('/products/<product_id>', methods=['DELETE'])
def delete_product(product_id):
    if product_id in products:
        del products[product_id]
        save_data("products.json", products)
        return jsonify({'message': 'Product deleted', 'products': products})
    return jsonify({'message': 'Product not found'}), 404

@app.route('/low_stock', methods=['GET'])
def low_stock():
    low_stock_products = {
        prod['name']: {
            'quantity': prod['quantity'],
            'ideal': prod['ideal_quantity']
        }
        for prod in products.values()
        if prod['quantity'] < prod['ideal_quantity']
    }
    return jsonify(low_stock_products)

@app.route('/product_overview', methods=['GET'])
def product_overview():
    overview = {}
    for product_id, product in products.items():
        name = product['name']
        quantity = product['quantity']
        ideal_quantity = product['ideal_quantity']
        status = get_stock_status(quantity, ideal_quantity)
        
        # Check if the product is allocated to any place
        allocated_place = 'Unallocated'
        place_id = None
        for pid, place_info in places.items():
            if isinstance(place_info, dict) and 'products' in place_info:
                if product_id in place_info['products']:
                    allocated_place = place_info['name']
                    place_id = pid
                    break
            
        overview[name] = {
            'count': quantity,
            'ideal': ideal_quantity,
            'status': status,
            'place': allocated_place,
            'placeId': place_id
        }
    return jsonify(overview)

@app.route('/allocate_product', methods=['POST'])
def allocate_product():
    product_name = request.form['product']
    place_id = request.form['place']
    
    product_id = next((id for id, prod in products.items() if prod['name'] == product_name), None)
    if not product_id:
        return jsonify({'success': False, 'message': 'Product not found'})
    
    # Remove product from its current place
    for p in places.values():
        if isinstance(p, dict) and 'products' in p:
            if product_id in p['products']:
                p['products'].remove(product_id)
    
    # Add product to new place or unallocate
    if place_id != 'unallocate':
        if place_id not in places:
            return jsonify({'success': False, 'message': 'Place not found'})
        places[place_id]['products'].append(product_id)
    
    save_data("places.json", places)
    return jsonify({'success': True, 'message': 'Product allocated successfully'})

def get_stock_status(current, ideal):
    if current < ideal:
        return 'text-danger'
    elif current > ideal:
        return 'text-success'
    return 'text-dark'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
