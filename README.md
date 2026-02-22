# HealthViz

An interactive, client-side dashboard for exploring hospital and patient analytics. It visualizes KPIs, demographics, medical conditions, test results, insurance costs, and revenue, with an interactive hospital map. Built with vanilla JavaScript, D3.js, and the ArcGIS JavaScript API.

## Features

### **KPIs & Overview**
- Key metrics with fast updates (patients, revenue, LOS, etc.)
- Optimized aggregations and DOM updates for responsiveness

### **Charts**
- **Donut Chart**: Test Results Distribution (Normal/Abnormal/Inconclusive)
- **Donut Chart**: Total Revenue by Blood Type
- **Line Chart**: Average Cost per Insurance Provider (with area fill)
- **Stacked Bar Chart**: Medical Conditions by Test Result
- **Stacked Bar Chart**: Patient Demographics (Age × Gender)
- **Violin Plot**: Billing Amount Distribution
- **Sankey Diagram**: Patient Flow (Admission → Condition → Result)

### **Interactive Map**
- ArcGIS-based hospital map with hover details and click-to-filter
- Hospitals are deterministically mapped to real US city coordinates so markers stay on land while preserving synthetic hospital names
- Initial view and the bottom-right minimap share the same continental US bounds so the first zoom level matches the minimap
- Debounced/throttled interactions to keep the UI smooth

### **Performance**
- Cached filters and hospital stats
- Lazy chart updates via IntersectionObserver
- Debouncing and requestAnimationFrame batching

### **Guided Tutorial**
- Optional driver.js onboarding with a short delay
- Step-by-step tour covering search, filters, KPIs (just before Test Results Distribution), and the main clinical/financial charts

## Screenshots

**Dashboard Overview**
![Dashboard Overview](.githubutils/dashboard1.png)

![Charts and Filters](.githubutils/dashboard2.png)

![Detailed Views](.githubutils/dashboard3.png)

![Hospital Map](.githubutils/dashboard4.png)

**Search & Filtering**
![Search & Filtering](.githubutils/search_filter.png)

**Tutorial Onboarding**
![Tutorial Onboarding](.githubutils/tutorial.png)

**Login Page**
![Login Page](.githubutils/login.png)

## Tech Stack

- **JavaScript** for logic
- **D3.js v7** for charts
- **ArcGIS API 4** for the map
- **driver.js** for tutorial
- **CSS** for layout and theme

## Project Structure

```
HealthViz/
├── index.html
├── README.md
├── css/
│   └── styles.css
├── data/
│   └── healthcare_dataset.csv
├── js/
│   ├── charts.js
│   ├── data.js
│   ├── main.js
│   ├── map.js
│   ├── state.js
│   ├── charts/
│   │   ├── billing.js
│   │   ├── conditions.js
│   │   ├── demographics.js
│   │   ├── patientFlow.js
│   │   └── testResults.js
│   └── utils/
│       ├── format.js
│       ├── geo.js
│       ├── stats.js
│       └── tooltip.js
```

## Getting Started

### Run Locally

Use any static file server. Options:

1. With `serve` (recommended)
   ```bash
   npx serve -l 3000
   ```
   If that fails, install globally:
   ```bash
   npm install -g serve
   serve -l 3000
   ```

2. With `http-server`
   ```bash
   npx http-server -p 3000
   ```

3. VS Code Live Server extension
- Open the folder and click "Go Live" (default port varies)

Then visit: http://localhost:3000

## Configuration

- Theme colors are defined in [css/styles.css](css/styles.css)
- Palette and app config live in [js/state.js](js/state.js)
- Data is loaded from [data/healthcare_dataset.csv](data/healthcare_dataset.csv)

You can replace the CSV with your own dataset (matching expected column names such as hospital, medical condition, test result, insurance provider, blood type, age group, gender, revenue/cost as used by the charts).

## Usage

- Use the filters in the UI to focus on hospitals, conditions, and results
- Hover on bars and map features for tooltips
- Charts update lazily when they become visible for performance
- Start the tutorial on first load

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

This project was done as part of an academic assignment for the information visualization course (InfoVis) at Higher National School of Computer Science (ESI Algiers), taught by Mrs. Fadloun Samiha. The dataset is synthetic and generated for educational purposes, inspired by real healthcare analytics scenarios. The design and implementation were guided by best practices in interactive dashboard development and performance optimization.