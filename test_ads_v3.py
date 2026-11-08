import json
import math
from datetime import datetime, timedelta

def simulate_forecast(data):
    products = data.get("products", [])
    sales = data.get("sales", [])
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    consumption = {}
    for s in sales:
        key = (s["productName"], s["location"])
        d = datetime.fromisoformat(s["date"])
        day_str = d.strftime("%Y-%m-%d")
        if key not in consumption: consumption[key] = {}
        consumption[key][day_str] = consumption[key].get(day_str, 0) + s["quantity"]

    results = []
    Z_SCORE = 1.65
    WINDOW = 30
    
    for p in products:
        key = (p["name"], p["location"])
        history = consumption.get(key, {})
        demands = []
        for i in range(WINDOW):
            d_key = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            demands.append(history.get(d_key, 0))
        
        total_qty = sum(demands)
        total_sales_count = sum(1 for x in demands if x > 0)
        
        if total_sales_count >= 3:
            avg_all = total_qty / WINDOW
            std_raw = math.sqrt(sum((x - avg_all)**2 for x in demands) / WINDOW)
            filter_threshold = avg_all + (2.5 * std_raw) if std_raw > 0 else 999
            filtered = [min(x, filter_threshold) if x > filter_threshold else x for x in demands]
            
            w1 = sum(filtered[0:7]) / 7.0
            w2 = sum(filtered[7:14]) / 7.0
            w3 = sum(filtered[14:30]) / 16.0
            ads = (w1 * 0.5) + (w2 * 0.3) + (w3 * 0.2)
            
            filtered_avg = sum(filtered) / WINDOW
            std_filtered = math.sqrt(sum((x - filtered_avg)**2 for x in filtered) / WINDOW)
            
            cv = (std_filtered / filtered_avg) if filtered_avg > 0 else 1
            safety_factor = 1.0 + min(cv, 1.0) 
            
            lead_time = 7 if ads < 1 else (10 if ads < 3 else 14)
            prediction_base = ads * lead_time
            
            raw_safety = Z_SCORE * std_filtered * math.sqrt(lead_time) * safety_factor
            safety_stock = min(raw_safety, prediction_base * 2) if ads > 0.5 else raw_safety
            
            target_stock = math.ceil(prediction_base + safety_stock)
        else:
            ads = total_qty / WINDOW
            target_stock = 3 if total_qty == 0 else 4
            
        results.append({"name": p["name"], "ads": round(ads, 3), "target": int(target_stock)})
    return results

today = datetime.utcnow()
sales = []
# A (Flat)
for i in range(30): sales.append({"productName": "Prod_A_Flat", "location": "L1", "quantity": 1, "date": (today - timedelta(days=i)).isoformat()})
# B (Growing)
for i in range(10): sales.append({"productName": "Prod_B_Growing", "location": "L1", "quantity": 3, "date": (today - timedelta(days=i)).isoformat()})
# C (Spiky) - was 105 before refinement
for i in range(30):
    qty = 50 if i == 15 else 1
    sales.append({"productName": "Prod_C_Spiky", "location": "L1", "quantity": qty, "date": (today - timedelta(days=i)).isoformat()})

data = {"products": [{"name": "Prod_A_Flat", "location": "L1"},{"name": "Prod_B_Growing", "location": "L1"},{"name": "Prod_C_Spiky", "location": "L1"}],"sales": sales}
results = simulate_forecast(data)
print("\n--- ADS v2 (Refined) Simulation Results ---")
for r in results: print(f"Product: {r['name']:<15} | ADS: {r['ads']:>6} | Target Stock: {r['target']:>3}")
