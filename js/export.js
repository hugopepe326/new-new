// js/export.js
async function generatePDF() {
    if (!currentData) {
        alert("Por favor, busca una ciudad o dibuja un área primero.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    
    btnText.textContent = "Procesando...";
    btnLoader.classList.remove('hidden');
    updateStatus("Generando PDF Vectorial...", 10);

    const pdfW = 595.28;
    const pdfH = 841.89;

    // Get current map bounds OR drawn area bounds
    let bounds;
    const drawnFeatures = draw.getAll().features;
    if (drawnFeatures.length > 0) {
        const b = getDrawBounds(drawnFeatures[0]);
        bounds = new maplibregl.LngLatBounds(b[0], b[1]);
    } else {
        bounds = map.getBounds();
    }
    
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const toWebMercator = (lat, lon) => {
        const x = (lon * 20037508.34) / 180;
        let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
        y = (y * 20037508.34) / 180;
        return { x, y };
    };

    const minM = toWebMercator(sw.lat, sw.lng);
    const maxM = toWebMercator(ne.lat, ne.lng);
    const mercW = maxM.x - minM.x;
    const mercH = maxM.y - minM.y;

    const margin = 25; 
    const scale = Math.min((pdfW - margin*2) / mercW, (pdfH - margin*2) / mercH);

    const mapW = mercW * scale;
    const mapH = mercH * scale;
    const offsetX = (pdfW - mapW) / 2;
    const offsetY = (pdfH - mapH) / 2;
    const baseBottom = pdfH - offsetY;

    const project = (lat, lon) => {
        const merc = toWebMercator(lat, lon);
        return {
            x: offsetX + (merc.x - minM.x) * scale,
            y: baseBottom - (merc.y - minM.y) * scale
        };
    };

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    
    const showStreets = document.getElementById('checkStreets').checked;
    const showBuildings = document.getElementById('checkBuildings').checked;
    const showWater = document.getElementById('checkWater').checked;

    const buckets = { water: [], buildings: [], streets: [] };
    currentData.features.forEach(f => {
        const p = f.properties || {};
        if (showWater && (p.waterway || p.natural === 'water')) buckets.water.push(f);
        else if (showBuildings && p.building) buckets.buildings.push(f);
        else if (showStreets && p.highway) buckets.streets.push(f);
    });

    const drawGroup = (features, style, isClosed) => {
        if (features.length === 0) return;
        pdf.setLineWidth(style.width);
        pdf.setDrawColor(style.stroke);
        if (style.fill) pdf.setFillColor(style.fill);

        features.forEach(f => {
            const type = f.geometry.type;
            const coords = f.geometry.coordinates;

            const drawArray = (arr) => {
                if (arr.length < 2) return;
                const p1 = project(arr[0][1], arr[0][0]);
                pdf.moveTo(p1.x, p1.y);
                for (let i = 1; i < arr.length; i++) {
                    const p = project(arr[i][1], arr[i][0]);
                    pdf.lineTo(p.x, p.y);
                }
                if (isClosed) {
                    pdf.closePath();
                    if (style.fill) pdf.fillAndStroke();
                    else pdf.stroke();
                } else pdf.stroke();
            };

            if (type === 'LineString') drawArray(coords);
            else if (type === 'MultiLineString') coords.forEach(drawArray);
            else if (type === 'Polygon') coords.forEach(drawArray);
            else if (type === 'MultiPolygon') coords.forEach(poly => poly.forEach(drawArray));
        });
    };

    drawGroup(buckets.water, { fill: "#e0f2fe", stroke: "#0ea5e9", width: 0.5 }, true);
    drawGroup(buckets.buildings, { fill: "#f1f5f9", stroke: "#64748b", width: 0.2 }, true);
    drawGroup(buckets.streets, { stroke: "#1e293b", width: 0.8 }, false);

    updateStatus("PDF Finalizado", 100);
    setTimeout(() => {
        pdf.save(`geoexport_pro_${Date.now()}.pdf`);
        btnText.textContent = "Descargar PDF (A4)";
        btnLoader.classList.add('hidden');
    }, 50);
}
