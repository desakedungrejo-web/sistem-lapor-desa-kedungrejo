// ==========================================================
// 1. KONFIGURASI SUPABASE & VARIABEL GLOBAL
// ==========================================================
const SUPABASE_URL = 'https://vztgdxektofrbrjempxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dGdkeGVrdG9mcmJyamVtcHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjY5MDQsImV4cCI6MjA4NTkwMjkwNH0.oPfyDRhTOWKEJ6NNdYXVRDNyXu6saaiAIcZ-PonyrAc';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variabel Data
let semuaDataLaporan = []; 
let koordinatTerpilih = null;
let markerLokasiAnda = null; 
let fileGambarInput = null;

// Variabel Peta & Layer
let realtimeMarker = null;
let realtimeCircle = null;
let firstLocationFound = false; 
let layerKedungrejo = L.geoJSON();
let layerDesaLain = L.geoJSON();
let labelKecamatanMarker = null;

// Cluster Option
let mainCluster = L.markerClusterGroup({
    disableClusteringAtZoom: 18,
    spiderfyOnMaxZoom: true
});

// Penampung Marker per Kategori
let markerData = { rusak: [], sampah: [], irigasi: [], lainnya: [], selesai: [] };

const icons = {
    rusak: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    sampah: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    irigasi: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    lainnya: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
    selesai: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png'
};

// ==========================================================
// 2. INISIALISASI PETA, BASEMAP & SIDEBAR
// ==========================================================
const map = L.map('map', { 
    zoomControl: false, minZoom: 5, 
    maxBounds: [[-11.0, 94.0], [6.0, 141.0]], maxBoundsViscosity: 1.0    
}).setView([-6.864528, 111.872511], 15);

// Basemap
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: 20, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
const gSat = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { subdomains:['mt0','mt1','mt2','mt3'], maxNativeZoom: 19, maxZoom: 20, attribution: '&copy; Google Maps' });
const esriDark = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, maxZoom: 20, attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ' });
const otm = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxNativeZoom: 18, maxZoom: 20, attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)' });
const esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 17, maxZoom: 20, attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community' });


const baseMaps = { "OpenStreetMap": osm, "Google Satellite": gSat, "Esri Dark": esriDark, "OpenTopoMap": otm, "Esri Topographic": esriTopo };
osm.addTo(map);
L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Tambahkan Layer Group ke Peta
mainCluster.addTo(map);
layerKedungrejo.addTo(map);
layerDesaLain.addTo(map);

// Sidebar Toggle
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggleBtn');
if(toggleBtn && sidebar) {
    toggleBtn.onclick = () => {
        sidebar.classList.toggle('active');
        toggleBtn.textContent = sidebar.classList.contains('active') ? '← ' : '→';
    };
}

// Logika Generalisasi Label
function updateMapLabels() {
    const zoom = map.getZoom();
    const labelDesa = document.querySelectorAll('.label-desa');
    if (zoom >= 13) {
        labelDesa.forEach(l => l.style.display = 'block');
        if (labelKecamatanMarker) map.removeLayer(labelKecamatanMarker);
    } else if (zoom >= 10 && zoom < 13) {
        labelDesa.forEach(l => l.style.display = 'none');
        if (labelKecamatanMarker) labelKecamatanMarker.addTo(map);
    } else {
        labelDesa.forEach(l => l.style.display = 'none');
        if (labelKecamatanMarker) map.removeLayer(labelKecamatanMarker);
    }
}
map.on('zoomend', updateMapLabels);

// ==========================================================
// 3. LEGENDA
// ==========================================================
const LegendControl = L.Control.extend({
    options: { position: 'topright' }, 
    onAdd: function() {
        const container = L.DomUtil.create('div', 'legend-container');
        const btn = L.DomUtil.create('button', 'toggle-legend', container);
        btn.innerHTML = '←'; 
        const content = L.DomUtil.create('div', 'legend-content', container);
        content.innerHTML = `
            <h4>Legenda</h4>
            <strong>Wilayah</strong><br>
            <input type="checkbox" id="chkKedungrejo" checked> <span style="display:inline-block; width:10px; height:10px; background:#f1c40f; border:1px solid #000;"></span> Kedungrejo<br>
            <input type="checkbox" id="chkDesaLain" checked> <span style="display:inline-block; width:10px; height:10px; background:#00d8f1; border:1px solid #00d8f1;"></span> Desa Lain<br>
            <hr style="margin:5px 0;">
            <strong>Kategori</strong><br>
            <input type="checkbox" id="chkRusak" checked> <img src="${icons.rusak}" width="12"> Infrastruktur<br>
            <input type="checkbox" id="chkSampah" checked> <img src="${icons.sampah}" width="12"> Sampah<br>
            <input type="checkbox" id="chkIrigasi" checked> <img src="${icons.irigasi}" width="12"> Irigasi<br>
            <input type="checkbox" id="chkLainnya" checked> <img src="${icons.lainnya}" width="12"> Lainnya<br>
            <input type="checkbox" id="chkSelesai" checked> <img src="${icons.selesai}" width="12"> Selesai`;

        L.DomEvent.on(btn, 'click', (e) => {
            L.DomEvent.stopPropagation(e);
            container.classList.toggle('active');
            btn.innerHTML = container.classList.contains('active') ? '→' : '← ';
        });

        content.querySelectorAll('input').forEach(chk => {
            L.DomEvent.disableClickPropagation(chk);
            chk.onchange = (e) => {
                const id = e.target.id;
                const mapID = { 'chkRusak':'rusak', 'chkSampah':'sampah', 'chkIrigasi':'irigasi', 'chkLainnya':'lainnya', 'chkSelesai':'selesai' };
                if (id === 'chkKedungrejo') {
                    if (e.target.checked) {
                        map.addLayer(layerKedungrejo);
                        layerKedungrejo.bringToFront(); // 👈 kunci di atas
                    } else {
                        map.removeLayer(layerKedungrejo);
                    }
                }
                if (id === 'chkDesaLain') e.target.checked ? map.addLayer(layerDesaLain) : map.removeLayer(layerDesaLain);
                const kat = mapID[id];
                if (kat) {
                    if (e.target.checked) markerData[kat].forEach(m => mainCluster.addLayer(m));
                    else markerData[kat].forEach(m => mainCluster.removeLayer(m));
                }
            };
        });
        return container;
    }
});
map.addControl(new LegendControl());

// ==========================================================
// 4. LOGIKA LOKASI (GPS, MANUAL & PETA)
// ==========================================================
function updateLokasiUI(lat, lon, sumber, updateInput = true) {
    const latitude = parseFloat(lat); 
    const longitude = parseFloat(lon);
    if (isNaN(latitude) || isNaN(longitude)) return;
    
    koordinatTerpilih = [latitude, longitude];
    const elStatus = document.getElementById('lokasiStatus');
    elStatus.textContent = `${sumber}: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    elStatus.style.color = "green";

    if (updateInput) {
        document.getElementById('manualLat').value = latitude.toFixed(6);
        document.getElementById('manualLon').value = longitude.toFixed(6);
    }
    
    if (markerLokasiAnda) map.removeLayer(markerLokasiAnda);
    markerLokasiAnda = L.marker([latitude, longitude], { draggable: true }).addTo(map);
    
    markerLokasiAnda.bindPopup(`
        <div style="text-align:center;">
            <strong>Lokasi Terpilih</strong><br>
            <button onclick="hapusTitikLaporan()" style="margin-top:5px; background:#c0392b; color:white; border:none; padding:5px; border-radius:3px; cursor:pointer;">Hapus Titik</button>
        </div>
    `).openPopup();

    markerLokasiAnda.on('dragend', (e) => {
        const p = e.target.getLatLng();
        updateLokasiUI(p.lat, p.lng, "Geser Marker");
    });
}

const handleManualInput = () => {
    const lat = document.getElementById('manualLat').value;
    const lon = document.getElementById('manualLon').value;
    if (lat && lon) {
        updateLokasiUI(lat, lon, "Manual", false);
        map.panTo([lat, lon]); 
    }
};

document.getElementById('manualLat').oninput = handleManualInput;
document.getElementById('manualLon').oninput = handleManualInput;

function hapusTitikLaporan() {
    if (markerLokasiAnda) {
        map.removeLayer(markerLokasiAnda);
        markerLokasiAnda = null;
        koordinatTerpilih = null;
        document.getElementById('lokasiStatus').textContent = "Status: Belum ada Lokasi";
        document.getElementById('lokasiStatus').style.color = "black";
        document.getElementById('manualLat').value = "";
        document.getElementById('manualLon').value = "";
    }
}

map.on('click', (e) => updateLokasiUI(e.latlng.lat, e.latlng.lng, "Klik Peta"));

document.getElementById('btnAmbilLokasi').onclick = () => {
    document.getElementById('lokasiStatus').textContent = "Mencari GPS...";
    navigator.geolocation.getCurrentPosition((p) => {
        updateLokasiUI(p.coords.latitude, p.coords.longitude, "GPS");
        map.setView([p.coords.latitude, p.coords.longitude], 17);
    }, (err) => alert("GPS Gagal: " + err.message), { enableHighAccuracy: true });
};

map.on('locationfound', (e) => {
    const radius = e.accuracy / 2;
    if (realtimeMarker) {
        realtimeMarker.setLatLng(e.latlng);
        realtimeCircle.setLatLng(e.latlng).setRadius(radius);
    } else {
        const blueDotIcon = L.divIcon({ className: 'blue-dot-container', html: '<div class="blue-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
        realtimeMarker = L.marker(e.latlng, { icon: blueDotIcon }).addTo(map);
        realtimeCircle = L.circle(e.latlng, radius, { color: '#4285F4', fillOpacity: 0.1, weight: 1 }).addTo(map);
    }
    if (!firstLocationFound) { map.setView(e.latlng, 17); firstLocationFound = true; }
});

// ==========================================================
// 5. RENDER LAPORAN (ANTI-CRASH)
// ==========================================================
function renderMarker(d) {
    try {
        // SAFETY 1: Cek Koordinat Valid
        if (!d.latitude || !d.longitude) return;

        const isSelesai = d.status === 'Selesai';
        let kategoriKey = isSelesai ? 'selesai' : d.kategori;

        // SAFETY 2: Cek Kategori Valid (Fallback ke 'lainnya')
        if (!markerData[kategoriKey]) {
            kategoriKey = 'lainnya'; 
        }

        const icoUrl = icons[kategoriKey] || icons['lainnya'];
        const ico = L.icon({ iconUrl: icoUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] });
        
        const footerAdmin = !isSelesai ? `
            <div style="border-top:1px solid #ccc; margin-top:10px; padding-top:10px;">
                <input type="email" id="adm-email-${d.id}" placeholder="Email Admin" style="width:100%; margin-bottom:5px; padding:5px; font-size:11px; box-sizing:border-box;">
                <input type="password" id="adm-pw-${d.id}" placeholder="Password" style="width:100%; margin-bottom:5px; padding:5px; font-size:11px; box-sizing:border-box;">
                <button onclick="prosesSelesaiAuth('${d.id}')" style="width:100%; background:#0f6b45; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold;">SELESAIKAN (ADMIN)</button>
            </div>` : '';

        const html = `<div style="width:200px;">
            <strong>${isSelesai ? '✅ SELESAI' : '📌 LAPORAN'}</strong><br>
            <small>${new Date(d.created_at).toLocaleString('id-ID')}</small>
            ${d.image_url ? `<img src="${d.image_url}" style="width:100%; border-radius:5px; margin-top:5px; cursor:pointer;" onclick="window.open('${d.image_url}', '_blank')">` : ''}
            ${isSelesai && d.foto_selesai_url ? `<div style="border-top:1px dashed green; margin-top:5px; padding-top:5px;"><img src="${d.foto_selesai_url}" style="width:100%; border-radius:5px;"><p><em>"${d.catatan_desa || ''}"</em></p></div>` : ''}
            <p><strong>Ket:</strong> ${d.keterangan || '-'}</p>
            ${footerAdmin}
        </div>`;

        const m = L.marker([d.latitude, d.longitude], { icon: ico }).bindPopup(html);
        
        // Push ke array kategori yang benar
        markerData[kategoriKey].push(m);
        mainCluster.addLayer(m);
        
    } catch (err) {
        console.error("Gagal merender satu marker:", err);
    }
}

async function prosesSelesaiAuth(id) {
    const email = document.getElementById(`adm-email-${id}`).value;
    const password = document.getElementById(`adm-pw-${id}`).value;
    if (!email || !password) return alert("Isi email dan password admin!");

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Gagal: " + error.message);
    } else {
        const fIn = document.createElement('input'); 
        fIn.type = 'file'; fIn.accept = 'image/*'; fIn.capture = 'environment';
        
        fIn.onchange = async (e) => {
            const file = e.target.files[0]; if (!file) return;
            const note = prompt("Catatan Penyelesaian:");

            if (note === null || note.trim() === "") {
                alert("Penyelesaian dibatalkan");
                return; // ⛔ STOP TOTAL
            }
            
            try {
                const imgK = await kompres(file);
                const path = `selesai_${id}_${Date.now()}.jpg`;
                await supabaseClient.storage.from('foto_laporan').upload(path, imgK);
                const url = supabaseClient.storage.from('foto_laporan').getPublicUrl(path).data.publicUrl;
                await supabaseClient.from('laporan_masuk').update({ 
                    status: 'Selesai', foto_selesai_url: url, catatan_desa: note 
                }).eq('id', id);
                alert("Laporan Selesai!"); location.reload();
            } catch (err) { alert(err.message); }
        };
        fIn.click();
    }
}

// ==========================================================
// 6. FILTER, UTILS & STARTUP
// ==========================================================
document.getElementById('btnTerapkanFilter').onclick = () => {
    const m = document.getElementById('filterTglMulai').value;
    const s = document.getElementById('filterTglSelesai').value;
    if (!m && !s) return alert("Pilih tanggal!");

    const filtered = semuaDataLaporan.filter(d => {
        const t = d.created_at.split('T')[0];
        if (m && s) return t >= m && t <= s;
        if (m) return t === m;
        if (s) return t === s;
        return true;
    });

    mainCluster.clearLayers();
    for(let k in markerData) markerData[k] = []; 
    filtered.forEach(renderMarker);
    document.getElementById('infoFilter').textContent = `Ditemukan ${filtered.length} Laporan`;
};

document.getElementById('btnResetFilter').onclick = () => {
    document.getElementById('filterTglMulai').value = '';
    document.getElementById('filterTglSelesai').value = '';
    mainCluster.clearLayers();
    for(let k in markerData) markerData[k] = [];
    semuaDataLaporan.forEach(renderMarker);
    document.getElementById('infoFilter').textContent = `Total ${semuaDataLaporan.length} Laporan`;
};

async function kompres(file) {
    return new Promise((res) => {
        const r = new FileReader(); r.readAsDataURL(file);
        r.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const c = document.createElement('canvas'); const m = 800; let w = img.width, h = img.height;
                if (w > m) { h *= m/w; w = m; } c.width = w; c.height = h;
                c.getContext('2d').drawImage(img, 0, 0, w, h);
                c.toBlob((b) => res(b), 'image/jpeg', 0.7);
            };
        };
    });
}

// FUNGSI STARTUP
async function start() {
    // 1. Label Kecamatan
    labelKecamatanMarker = L.marker([-6.890128, 111.855927], {
        icon: L.divIcon({ className: 'invisible-icon' }) 
    }).bindTooltip("KECAMATAN KEREK", { 
        permanent: true, direction: "center", className: "label-kecamatan" 
    });

    // 2. Muat GeoJSON
    fetch('Batas_Admin_Kerek.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            filter: (f) => f.properties.NAMOBJ === 'KEDUNGREJO',
            style: { color: "#f1c40f", weight: 7, fillOpacity: 0.03 },
            onEachFeature: (f, l) => l.bindTooltip(f.properties.NAMOBJ, { permanent: true, className: "label-desa" })
        }).addTo(layerKedungrejo);

        L.geoJSON(data, {
            filter: (f) => f.properties.NAMOBJ !== 'KEDUNGREJO',
            style: { color: "#00d8f1", weight: 1.5, fillOpacity: 0.05 },
            onEachFeature: (f, l) => l.bindTooltip(f.properties.NAMOBJ, { permanent: true, className: "label-desa" })
        }).addTo(layerDesaLain);
        
        setTimeout(updateMapLabels, 500); 
    });

    map.locate({ watch: true, enableHighAccuracy: true });

    // 3. MUAT DATA SUPABASE (DENGAN SAFEGUARD)
    const { data } = await supabaseClient.from('laporan_masuk').select('*').order('created_at', { ascending: false });
    if (data) { 
        semuaDataLaporan = data; 
        data.forEach(renderMarker); 
        document.getElementById('infoFilter').textContent = `Total: ${data.length} Laporan`;
    }
}

document.getElementById('laporForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!koordinatTerpilih) return alert("Pilih lokasi (Klik Peta / GPS / Manual)!");
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Mengirim...";
    try {
        let url = null;
        if (fileGambarInput) {
            const path = `warga_${Date.now()}.jpg`;
            await supabaseClient.storage.from('foto_laporan').upload(path, fileGambarInput);
            url = supabaseClient.storage.from('foto_laporan').getPublicUrl(path).data.publicUrl;
        }
        await supabaseClient.from('laporan_masuk').insert([{
            kategori: document.getElementById('kategori').value, keterangan: document.getElementById('keterangan').value,
            latitude: koordinatTerpilih[0], longitude: koordinatTerpilih[1], image_url: url, status: 'Proses'
        }]);
        alert("Berhasil!"); location.reload();
    } catch (err) { alert(err.message); btn.disabled = false; }
};

document.getElementById('btnKamera').onclick = () => document.getElementById('inputGambar').click();
document.getElementById('inputGambar').onchange = (e) => {
    if (e.target.files[0]) {
    kompres(e.target.files[0]).then(b => {
        fileGambarInput = b;
        const el = document.getElementById('namaFile');
        el.textContent = "Gambar Siap ✅";
        el.style.color = "green"; // 👈 jadi hijau
    });
}
};

start();




