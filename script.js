console.log("WebGIS loaded!");

/* ============================================
   1. MAP ENGINE
   ============================================ */
const map = L.map('map', {
    center: [4.1550, 117.2787],   // pusat area data (lat, lng)
    zoom: 16,
    zoomControl: false,
    minZoom: 5,
    maxZoom: 19
});

/* ============================================
   2. BASEMAP
   ============================================ */
const osm = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }
).addTo(map);

/* ============================================
   3. MAP CONTROLS
   ============================================ */
L.control.zoom({
    position: 'topright'
}).addTo(map);

L.control.scale({
    metric: true,
    imperial: false,
    position: 'bottomleft'
}).addTo(map);

/* ============================================
   4. EVENT LISTENER (KLIK)
   Klik pada fitur tidak memicu alert (bubblingMouseEvents: false),
   alert hanya muncul saat klik di area kosong peta.
   ============================================ */
let sedangMengukur = false;   // diatur oleh plugin Measure (bagian 10)

map.on('click', function (e) {
    if (sedangMengukur) return;   // pengaman: jangan tampilkan alert saat mengukur

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    alert("Koordinat: " + lat + ", " + lng);
});

/* ============================================
   5. LANDCOVER (RASTER GeoTIFF)
   data/landcover.tif dibaca langsung di browser:
   fetch -> arrayBuffer -> parseGeoraster -> GeoRasterLayer.
   Projeksi UTM 50N (EPSG:32650) dibaca otomatis dari file TIF.
   Layer dibuat setelah file selesai diunduh & dibaca, lalu
   ditambahkan ke peta dan ke layer control (bagian 8).
   ============================================ */

// Warna per kelas piksel (kelas 0 = nodata -> transparan)
const kelasLandcover = {
    1:  { nama: 'Air',                  warna: '#419bdf' },
    2:  { nama: 'Pohon',                warna: '#397d49' },
    4:  { nama: 'Vegetasi tergenang',   warna: '#7a87c6' },
    5:  { nama: 'Tanaman pertanian',    warna: '#e49635' },
    7:  { nama: 'Area terbangun',       warna: '#c4281b' },
    8:  { nama: 'Lahan terbuka',        warna: '#a59b8f' },
    10: { nama: 'Awan',                 warna: '#616161' },
    11: { nama: 'Rangeland',            warna: '#e3e2c3' }
};

function warnaLandcover(values) {
    const kelas = kelasLandcover[values[0]];
    return kelas ? kelas.warna : null;   // null = tidak digambar
}

let layerLandcover = null;

fetch('data/landcover.tif')
    .then(res => res.arrayBuffer())
    .then(arrayBuffer => parseGeoraster(arrayBuffer))
    .then(georaster => {
        console.log("Landcover georaster:", georaster);

        layerLandcover = new GeoRasterLayer({
            georaster: georaster,
            opacity: 0.6,
            resolution: 256,
            pixelValuesToColorFn: warnaLandcover
        });

        layerLandcover.addTo(map);
        layerLandcover.bringToBack();   // di bawah layer vektor
        layersControl.addOverlay(layerLandcover, 'Landcover (raster 10 m)');
    })
    .catch(err => console.error("Gagal load landcover.tif:", err));

/* ============================================
   6. STYLE & FUNGSI BANTU
   ============================================ */

/* 6.1 Bangunan: warna berdasarkan kategori (dari atribut Nama_Obj) */
const kategoriBangunan = {
    'Pemukiman':        'Hunian',
    'Toko':             'Perdagangan & Jasa',
    'Warung':           'Perdagangan & Jasa',
    'Warung Makan':     'Perdagangan & Jasa',
    'Cafe':             'Perdagangan & Jasa',
    'Pasar':            'Perdagangan & Jasa',
    'Bank':             'Perdagangan & Jasa',
    'Bengkel':          'Perdagangan & Jasa',
    'Penginapan':       'Wisata & Penginapan',
    'Atraksi':          'Wisata & Penginapan',
    'Sekolah':          'Pendidikan',
    'Masjid':           'Ibadah',
    'Musholla':         'Ibadah',
    'Gereja':           'Ibadah',
    'Puskesmas':        'Kesehatan',
    'Kantor Desa':      'Pemerintahan',
    'Kantor Kecamatan': 'Pemerintahan',
    'Gedung Kecamatan': 'Pemerintahan',
    'Kantor Polisi':    'Pemerintahan',
    'KopDes':           'Pemerintahan',
    'Kantor BUMDes':    'Pemerintahan'
};

const warnaKategori = {
    'Hunian':              '#9ca3af',
    'Perdagangan & Jasa':  '#f59e0b',
    'Wisata & Penginapan': '#a855f7',
    'Pendidikan':          '#3b82f6',
    'Ibadah':              '#10b981',
    'Kesehatan':           '#ef4444',
    'Pemerintahan':        '#1e3a8a'
};

function getKategori(namaObj) {
    return kategoriBangunan[namaObj] || 'Hunian';
}

function styleBangunan(feature) {
    const kategori = getKategori(feature.properties.Nama_Obj);
    return {
        fillColor: warnaKategori[kategori],
        fillOpacity: 0.85,
        color: '#333333',
        weight: 0.8,
        bubblingMouseEvents: false
    };
}

/* 6.2 Vegetasi: data-driven (numeric threshold) berdasarkan luas (ha) */
function getColor(luas) {
    if (luas > 2) return '#166534';   // luas  > 2 ha
    if (luas > 1) return '#22c55e';   // 1 - 2 ha
    return '#bbf7d0';                 // < 1 ha
}

function styleVegetasi(feature) {
    return {
        fillColor: getColor(feature.properties.area),
        fillOpacity: 0.7,
        color: '#14532d',
        weight: 1,
        bubblingMouseEvents: false
    };
}

/* 6.3 Lahan kosong */
function styleLahanKosong(feature) {
    return {
        fillColor: '#d6b98c',
        fillOpacity: 0.7,
        color: '#8b6b3d',
        weight: 1.5,
        dashArray: '5, 4',
        bubblingMouseEvents: false
    };
}

/* 6.4 Jalan */
function styleJalan(feature) {
    return {
        color: '#dc2626',
        weight: 4,
        opacity: 0.9,
        bubblingMouseEvents: false
    };
}

/* ============================================
   7. LOAD GEOJSON (FETCH API + L.geoJSON)
   Semua layer dimasukkan ke variabel agar bisa diatur di layer control.
   ============================================ */
const layerBangunan   = L.layerGroup();
const layerVegetasi   = L.layerGroup();
const layerLahanKosong = L.layerGroup();
const layerJalan      = L.layerGroup();

/* 7.1 Bangunan (MultiPolygon, 191 fitur) */
const pBangunan = fetch('data/Data_Bangunan.geojson')
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleBangunan,
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(
                    `<b>${p.Nama_Obj}</b><br>` +
                    `Kategori: ${getKategori(p.Nama_Obj)}<br>` +
                    `Keterangan: ${p.Keterangan}<br>` +
                    `Luas: ${p.area} ha`
                );
                // Tooltip hanya untuk fasilitas (bukan rumah warga) agar peta tidak penuh
                if (p.Nama_Obj !== 'Pemukiman') {
                    layer.bindTooltip(p.Nama_Obj);
                }
            }
        }).addTo(layerBangunan);
    })
    .catch(err => console.error("Gagal load Data_Bangunan.geojson:", err));

/* 7.2 Vegetasi (MultiPolygon, 26 fitur) */
const pVegetasi = fetch('data/Data_vegetasi.geojson')
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleVegetasi,
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(
                    `<b>${p.Nama_Obj}</b><br>` +
                    `${p.Keterangan}<br>` +
                    `Luas: ${p.area} ha`
                );
                layer.bindTooltip(p.Keterangan);
            }
        }).addTo(layerVegetasi);
    })
    .catch(err => console.error("Gagal load Data_vegetasi.geojson:", err));

/* 7.3 Lahan Kosong (MultiPolygon, 3 fitur) */
const pLahanKosong = fetch('data/Data_LahanKosong.geojson')
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleLahanKosong,
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(
                    `<b>${p.Nama_Obj}</b><br>` +
                    `Kelas: ${p.Kelas_Obj}<br>` +
                    `Luas: ${p.Area} ha`
                );
                layer.bindTooltip(p.Nama_Obj);
            }
        }).addTo(layerLahanKosong);
    })
    .catch(err => console.error("Gagal load Data_LahanKosong.geojson:", err));

/* 7.4 Jalan (MultiLineString, 15 fitur)
   Catatan: atribut "area" pada data jalan sebenarnya panjang jalan (km). */
const pJalan = fetch('data/Data_jalan.geojson')
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            style: styleJalan,
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(
                    `<b>${p.Nama_Obj}</b><br>` +
                    `${p.Keterangan}<br>` +
                    `Panjang: ${p.area} km`
                );
                layer.bindTooltip(p.Nama_Obj);
            }
        }).addTo(layerJalan);
    })
    .catch(err => console.error("Gagal load Data_jalan.geojson:", err));

/* Urutan tampil: landcover (bawah, ditambahkan saat TIF selesai dibaca) -> lahan kosong -> vegetasi -> jalan -> bangunan (atas) */
layerLahanKosong.addTo(map);
layerVegetasi.addTo(map);
layerJalan.addTo(map);
layerBangunan.addTo(map);

/* ============================================
   8. LAYER CONTROL
   ============================================ */
const layersControl = L.control.layers(
    { 'OpenStreetMap': osm },
    {
        'Lahan Kosong': layerLahanKosong,
        'Vegetasi': layerVegetasi,
        'Jalan': layerJalan,
        'Bangunan': layerBangunan
    },
    { position: 'topright', collapsed: window.innerWidth < 600 }
).addTo(map);

/* ============================================
   9. LEGENDA
   ============================================ */
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');

    let html = '<b>Bangunan</b>';
    for (const kategori in warnaKategori) {
        html += `<i style="background:${warnaKategori[kategori]}"></i>${kategori}<br>`;
    }

    html += '<b>Vegetasi (luas)</b>' +
        '<i style="background:#166534"></i>&gt; 2 ha<br>' +
        '<i style="background:#22c55e"></i>1 - 2 ha<br>' +
        '<i style="background:#bbf7d0"></i>&lt; 1 ha<br>';

    html += '<b>Lainnya</b>' +
        '<i style="background:#d6b98c"></i>Lahan Kosong<br>' +
        '<i style="background:#dc2626"></i>Jalan<br>';

    html += '<b>Landcover</b>';
    [2, 7, 5, 11].forEach(k => {
        html += `<i style="background:${kelasLandcover[k].warna}"></i>${kelasLandcover[k].nama}<br>`;
    });

    div.innerHTML = html;
    return div;
};

legend.addTo(map);

/* ============================================
   10. MEASURE (UKUR JARAK & LUAS)  - DAY 3
   Plugin: leaflet-measure (CSS & JS dimuat di index.html)
   ============================================ */
// Matikan auto-pan marker: penyebab peta melompat saat klik di mode ukur
L.Marker.mergeOptions({ autoPanOnFocus: false });

const measureControl = new L.Control.Measure({
    position: 'topleft',              // tambahan: agar tidak menumpuk dengan layer control
    primaryLengthUnit: 'meters',
    secondaryLengthUnit: 'kilometers',
    primaryAreaUnit: 'sqmeters',
    secondaryAreaUnit: 'hectares',    // tambahan: sesuai slide, satuan hektar (ha)
    activeColor: '#6366f1',
    completedColor: '#10b981'
});

measureControl.addTo(map);

// Saat mengukur, geser dengan klik kiri dimatikan
map.on('measurestart',  () => { sedangMengukur = true;  map.dragging.disable(); });
map.on('measurefinish', () => { sedangMengukur = false; map.dragging.enable();  });

/* ============================================
   11. SEARCH BAR (CARI FASILITAS)  - DAY 3
   Plugin: leaflet-search (CSS & JS dimuat di index.html)
   Pencarian berdasarkan atribut `nama_fasilitas`.
   Atribut ini dibuat dari data (bagian 11.1) karena data pelatihan
   belum punya kolom `nama_fasilitas`.
   ============================================ */

/* 11.1 Buat atribut nama_fasilitas
   - Bangunan: hanya fasilitas (Nama_Obj bukan 'Pemukiman'), nama dari Keterangan
   - Vegetasi: nama dari Keterangan (mis. "Kebun Kelapa Sawit Blok - 1")
   - Lahan kosong: nama dari Nama_Obj
   Nama yang kembar diberi nomor, mis. "Warung Makan (2)", karena plugin
   menyimpan hasil pencarian per nama (nama kembar akan saling menimpa). */
const namaTerpakai = {};

function buatNamaUnik(nama) {
    if (!namaTerpakai[nama]) {
        namaTerpakai[nama] = 1;
        return nama;
    }
    namaTerpakai[nama]++;
    return `${nama} (${namaTerpakai[nama]})`;
}

// Jalankan callback untuk setiap fitur di dalam layer group (termasuk L.geoJSON di dalamnya)
function untukSetiapFitur(group, callback) {
    group.eachLayer(layer => {
        if (layer.feature) callback(layer);
        else if (layer.eachLayer) untukSetiapFitur(layer, callback);
    });
}

function isiNamaFasilitas(group, ambilNama) {
    untukSetiapFitur(group, layer => {
        const nama = ambilNama(layer.feature.properties);
        if (nama) layer.feature.properties.nama_fasilitas = buatNamaUnik(nama);
    });
}

/* 11.2 Pasang Search Control setelah semua GeoJSON selesai dimuat */
Promise.all([pBangunan, pVegetasi, pLahanKosong]).then(() => {

    isiNamaFasilitas(layerBangunan,    p => p.Nama_Obj !== 'Pemukiman' ? p.Keterangan : null);
    isiNamaFasilitas(layerVegetasi,    p => p.Keterangan);
    isiNamaFasilitas(layerLahanKosong, p => p.Nama_Obj);

    // Layer pencarian = gabungan layer yang punya nama_fasilitas
    const layerCari = L.layerGroup([layerBangunan, layerVegetasi, layerLahanKosong]);

    const searchControl = new L.Control.Search({
        layer: layerCari,
        propertyName: 'nama_fasilitas',
        zoom: 17,
        initial: false,               // cocokkan teks di mana saja, bukan hanya awal kata
        marker: false,
        textPlaceholder: 'Cari nama fasilitas...'
    });

    map.addControl(searchControl);

    // Tambahan: buka popup fitur yang ditemukan
    searchControl.on('search:locationfound', function (e) {
        if (e.layer && e.layer.openPopup) e.layer.openPopup();
    });
});
