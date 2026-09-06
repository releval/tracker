// ================================================================
// RelevalTech Shared Code (example infrastructure)
// Product data, cart helpers, header, event log, toast
// ================================================================

// ================================================================
// Product Data (40 products)
// ================================================================
var products = [
  { id: 'NT-001', name: 'Quantum Earbuds', price: 79.99, category: 'Audio', description: 'Wireless earbuds with quantum noise cancellation', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#805AD5" opacity="0.12"/><circle cx="75" cy="70" r="22" fill="#805AD5"/><circle cx="125" cy="70" r="22" fill="#805AD5"/><path d="M75 48 Q100 30 125 48" stroke="#805AD5" stroke-width="3" fill="none"/><circle cx="75" cy="70" r="8" fill="#fff"/><circle cx="125" cy="70" r="8" fill="#fff"/></svg>' },
  { id: 'NT-002', name: 'Photon Smart Watch', price: 249.99, category: 'Wearables', description: 'Solar-powered smartwatch with health tracking', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#38A169" opacity="0.12"/><rect x="70" y="30" width="60" height="80" rx="12" fill="#38A169"/><rect x="80" y="42" width="40" height="40" rx="6" fill="#fff"/><rect x="60" y="45" width="10" height="20" rx="3" fill="#38A169"/><rect x="130" y="45" width="10" height="20" rx="3" fill="#38A169"/></svg>' },
  { id: 'NT-003', name: 'NebulaPad Pro', price: 599.99, category: 'Tablets', description: '12-inch tablet with holographic display', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#3182CE" opacity="0.12"/><rect x="45" y="20" width="110" height="80" rx="8" fill="#3182CE"/><rect x="52" y="27" width="96" height="60" rx="4" fill="#fff"/><circle cx="100" cy="108" r="5" fill="#3182CE"/></svg>' },
  { id: 'NT-004', name: 'Pulse Fitness Band', price: 49.99, category: 'Wearables', description: 'Lightweight fitness tracker with heart rate monitoring', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#38A169" opacity="0.12"/><rect x="65" y="50" width="70" height="25" rx="12" fill="#38A169"/><circle cx="85" cy="62" r="4" fill="#fff"/><circle cx="100" cy="62" r="4" fill="#fff"/><circle cx="115" cy="62" r="4" fill="#fff"/><rect x="55" y="55" width="10" height="15" rx="5" fill="#38A169"/><rect x="135" y="55" width="10" height="15" rx="5" fill="#38A169"/></svg>' },
  { id: 'NT-005', name: 'Echo Speaker Mini', price: 39.99, category: 'Audio', description: 'Compact smart speaker with room-filling sound', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#805AD5" opacity="0.12"/><circle cx="100" cy="65" r="35" fill="#805AD5"/><circle cx="100" cy="65" r="20" fill="#fff" opacity="0.3"/><rect x="90" y="100" width="20" height="15" rx="4" fill="#805AD5"/></svg>' },
  { id: 'NT-006', name: 'Vortex Wireless Charger', price: 34.99, category: 'Accessories', description: 'Fast wireless charger with alignment magnets', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#DD6B20" opacity="0.12"/><circle cx="100" cy="70" r="35" fill="#DD6B20" opacity="0.3"/><circle cx="100" cy="70" r="25" fill="#DD6B20"/><path d="M90 60 L100 50 L110 60" stroke="#fff" stroke-width="3" fill="none"/><rect x="98" y="60" width="4" height="18" rx="2" fill="#fff"/></svg>' },
  { id: 'NT-007', name: 'Zenith Noise-Cancel Headphones', price: 199.99, category: 'Audio', description: 'Over-ear headphones with adaptive ANC', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#805AD5" opacity="0.12"/><path d="M65 40 Q65 25 80 25 L120 25 Q135 25 135 40 L135 90 Q135 105 120 105 L80 105 Q65 105 65 90 Z" fill="#805AD5"/><rect x="75" y="35" width="50" height="60" rx="8" fill="#fff" opacity="0.25"/><rect x="55" y="50" width="10" height="30" rx="5" fill="#805AD5"/><rect x="135" y="50" width="10" height="30" rx="5" fill="#805AD5"/><path d="M55 65 Q40 65 40 50 L40 40" stroke="#805AD5" stroke-width="4" fill="none"/><path d="M145 65 Q160 65 160 50 L160 40" stroke="#805AD5" stroke-width="4" fill="none"/></svg>' },
  { id: 'NT-008', name: 'Prism 4K Webcam', price: 89.99, category: 'Cameras', description: '4K webcam with auto-framing AI', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#E53E3E" opacity="0.12"/><rect x="55" y="40" width="90" height="60" rx="10" fill="#E53E3E"/><circle cx="100" cy="70" r="18" fill="#fff"/><circle cx="100" cy="70" r="12" fill="#E53E3E"/><circle cx="100" cy="70" r="5" fill="#fff"/><rect x="125" y="48" width="12" height="8" rx="4" fill="#fff" opacity="0.5"/></svg>' },
  { id: 'NT-009', name: 'Orbit Portable SSD', price: 129.99, category: 'Storage', description: '1TB portable SSD, shock-resistant design', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#2B6CB0" opacity="0.12"/><rect x="55" y="40" width="90" height="55" rx="10" fill="#2B6CB0"/><rect x="65" y="50" width="30" height="6" rx="3" fill="#fff" opacity="0.5"/><circle cx="130" cy="80" r="5" fill="#fff" opacity="0.5"/><rect x="80" y="95" width="40" height="6" rx="3" fill="#2B6CB0"/></svg>' },
  { id: 'NT-010', name: 'Flux USB-C Hub', price: 59.99, category: 'Accessories', description: '7-in-1 USB-C hub with 4K HDMI output', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#DD6B20" opacity="0.12"/><rect x="50" y="50" width="100" height="35" rx="6" fill="#DD6B20"/><rect x="60" y="58" width="12" height="18" rx="2" fill="#fff" opacity="0.5"/><rect x="78" y="58" width="12" height="18" rx="2" fill="#fff" opacity="0.5"/><rect x="96" y="58" width="12" height="18" rx="2" fill="#fff" opacity="0.5"/><rect x="114" y="58" width="12" height="18" rx="2" fill="#fff" opacity="0.5"/><rect x="132" y="58" width="12" height="18" rx="2" fill="#fff" opacity="0.5"/><rect x="90" y="85" width="20" height="10" rx="3" fill="#DD6B20"/></svg>' },
  { id: 'NT-011', name: 'Aether Smart Glasses', price: 399.99, category: 'Wearables', description: 'AR-enabled smart glasses, ultra-lightweight', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#38A169" opacity="0.12"/><rect x="50" y="50" width="100" height="35" rx="17" fill="#38A169"/><rect x="58" y="56" width="35" height="23" rx="4" fill="#fff" opacity="0.3"/><rect x="107" y="56" width="35" height="23" rx="4" fill="#fff" opacity="0.3"/><rect x="40" y="60" width="10" height="15" rx="4" fill="#38A169"/><rect x="150" y="60" width="10" height="15" rx="4" fill="#38A169"/></svg>' },
  { id: 'NT-012', name: 'Nova Mechanical Keyboard', price: 149.99, category: 'Input', description: 'Hot-swappable mechanical keyboard with RGB lighting', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#D69E2E" opacity="0.12"/><rect x="30" y="45" width="140" height="50" rx="8" fill="#D69E2E"/><g fill="#fff" opacity="0.6"><rect x="40" y="52" width="14" height="14" rx="3"/><rect x="58" y="52" width="14" height="14" rx="3"/><rect x="76" y="52" width="14" height="14" rx="3"/><rect x="94" y="52" width="14" height="14" rx="3"/><rect x="112" y="52" width="14" height="14" rx="3"/><rect x="130" y="52" width="14" height="14" rx="3"/><rect x="148" y="52" width="14" height="14" rx="3"/><rect x="40" y="72" width="14" height="14" rx="3"/><rect x="58" y="72" width="70" height="14" rx="3"/><rect x="132" y="72" width="30" height="14" rx="3"/></g></svg>' },
  { id: 'NT-013', name: 'Drift Gaming Mouse', price: 69.99, category: 'Input', description: 'Ultra-light gaming mouse with 25K DPI sensor', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#D69E2E" opacity="0.12"/><ellipse cx="100" cy="70" rx="30" ry="40" fill="#D69E2E"/><rect x="88" y="28" width="24" height="10" rx="5" fill="#D69E2E"/><circle cx="100" cy="55" r="4" fill="#fff"/><rect x="96" y="62" width="8" height="15" rx="4" fill="#fff" opacity="0.4"/></svg>' },
  { id: 'NT-014', name: 'Beacon Mesh Router', price: 179.99, category: 'Networking', description: 'Wi-Fi 7 mesh router with whole-home coverage', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#00B5D8" opacity="0.12"/><rect x="60" y="55" width="80" height="40" rx="8" fill="#00B5D8"/><rect x="70" y="62" width="4" height="12" rx="2" fill="#fff" opacity="0.5"/><rect x="78" y="58" width="4" height="16" rx="2" fill="#fff" opacity="0.5"/><rect x="86" y="65" width="4" height="9" rx="2" fill="#fff" opacity="0.5"/><circle cx="130" cy="75" r="5" fill="#fff" opacity="0.5"/><rect x="72" y="42" width="4" height="13" rx="2" fill="#00B5D8"/><rect x="88" y="38" width="4" height="17" rx="2" fill="#00B5D8"/><rect x="104" y="42" width="4" height="13" rx="2" fill="#00B5D8"/></svg>' },
  { id: 'NT-015', name: 'Spark Power Bank', price: 44.99, category: 'Accessories', description: '20000mAh power bank with fast charging', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#DD6B20" opacity="0.12"/><rect x="65" y="35" width="70" height="70" rx="10" fill="#DD6B20"/><rect x="78" y="48" width="44" height="20" rx="4" fill="#fff" opacity="0.3"/><path d="M85 80 L100 68 L115 80" stroke="#fff" stroke-width="3" fill="none"/><rect x="98" y="80" width="4" height="12" rx="2" fill="#fff"/></svg>' },
  { id: 'NT-016', name: 'Clarity Monitor Light', price: 54.99, category: 'Accessories', description: 'Monitor light bar with adjustable color temperature', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#DD6B20" opacity="0.12"/><rect x="30" y="60" width="140" height="8" rx="4" fill="#DD6B20"/><circle cx="60" cy="64" r="12" fill="#DD6B20"/><circle cx="60" cy="64" r="6" fill="#fff" opacity="0.5"/><rect x="30" y="56" width="4" height="16" rx="2" fill="#DD6B20"/><rect x="166" y="56" width="4" height="16" rx="2" fill="#DD6B20"/></svg>' },
  { id: 'NT-017', name: 'Wave Smart Thermostat', price: 129.99, category: 'Smart Home', description: 'AI-learning thermostat with energy savings', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#319795" opacity="0.12"/><circle cx="100" cy="65" r="32" fill="#319795"/><circle cx="100" cy="65" r="22" fill="#fff" opacity="0.2"/><path d="M88 60 L96 72 L112 55" stroke="#fff" stroke-width="3" fill="none"/><rect x="90" y="97" width="20" height="12" rx="4" fill="#319795"/></svg>' },
  { id: 'NT-018', name: 'Shield Dash Cam', price: 99.99, category: 'Cameras', description: '1440p dash cam with night vision', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#E53E3E" opacity="0.12"/><rect x="50" y="40" width="100" height="50" rx="8" fill="#E53E3E"/><circle cx="85" cy="65" r="15" fill="#fff" opacity="0.3"/><circle cx="85" cy="65" r="8" fill="#E53E3E"/><rect x="115" y="50" width="25" height="10" rx="3" fill="#fff" opacity="0.3"/><rect x="70" y="90" width="60" height="10" rx="4" fill="#E53E3E"/></svg>' },
  { id: 'NT-019', name: 'Zen Air Purifier', price: 159.99, category: 'Smart Home', description: 'HEPA air purifier with app control', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#319795" opacity="0.12"/><rect x="70" y="30" width="60" height="80" rx="12" fill="#319795"/><circle cx="100" cy="55" r="10" fill="#fff" opacity="0.3"/><rect x="85" y="75" width="30" height="4" rx="2" fill="#fff" opacity="0.4"/><rect x="85" y="83" width="30" height="4" rx="2" fill="#fff" opacity="0.4"/><rect x="85" y="91" width="30" height="4" rx="2" fill="#fff" opacity="0.4"/></svg>' },
  { id: 'NT-020', name: 'Bolt Cable Set', price: 24.99, category: 'Accessories', description: 'Braided USB-C cables, 3-pack assorted lengths', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#DD6B20" opacity="0.12"/><path d="M50 70 Q75 40 100 70 Q125 100 150 70" stroke="#DD6B20" stroke-width="5" fill="none"/><path d="M50 55 Q75 25 100 55 Q125 85 150 55" stroke="#DD6B20" stroke-width="5" fill="none" opacity="0.4"/><path d="M50 85 Q75 55 100 85 Q125 115 150 85" stroke="#DD6B20" stroke-width="5" fill="none" opacity="0.4"/><circle cx="50" cy="70" r="6" fill="#DD6B20"/><circle cx="150" cy="70" r="6" fill="#DD6B20"/></svg>' },
  { id: 'NT-021', name: 'Sonic Soundbar', price: 149.99, category: 'Audio', description: 'Slim soundbar with Dolby Atmos and wireless subwoofer', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#805AD5" opacity="0.12"/><rect x="25" y="60" width="150" height="20" rx="10" fill="#805AD5"/><circle cx="55" cy="70" r="6" fill="#fff" opacity="0.4"/><circle cx="80" cy="70" r="6" fill="#fff" opacity="0.4"/><circle cx="120" cy="70" r="6" fill="#fff" opacity="0.4"/><circle cx="145" cy="70" r="6" fill="#fff" opacity="0.4"/><rect x="95" y="63" width="10" height="14" rx="2" fill="#fff" opacity="0.3"/></svg>' },
  { id: 'NT-022', name: 'Horizon VR Headset', price: 349.99, category: 'Wearables', description: 'Standalone VR headset with 4K per eye and hand tracking', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#38A169" opacity="0.12"/><rect x="45" y="45" width="110" height="50" rx="25" fill="#38A169"/><rect x="55" y="52" width="35" height="30" rx="4" fill="#fff" opacity="0.25"/><rect x="110" y="52" width="35" height="30" rx="4" fill="#fff" opacity="0.25"/><rect x="35" y="60" width="10" height="20" rx="5" fill="#38A169"/><rect x="155" y="60" width="10" height="20" rx="5" fill="#38A169"/></svg>' },
  { id: 'NT-023', name: 'Pixel Stylus Pen', price: 29.99, category: 'Input', description: 'Pressure-sensitive stylus with tilt detection and palm rejection', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#D69E2E" opacity="0.12"/><line x1="60" y1="110" x2="140" y2="30" stroke="#D69E2E" stroke-width="8" stroke-linecap="round"/><circle cx="140" cy="30" r="6" fill="#D69E2E"/><circle cx="60" cy="110" r="3" fill="#fff"/></svg>' },
  { id: 'NT-024', name: 'Nimbus Cloud Hub', price: 199.99, category: 'Storage', description: 'Personal cloud storage hub with 4TB and remote access', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#2B6CB0" opacity="0.12"/><path d="M60 85 Q60 55 85 55 Q90 40 110 40 Q135 40 138 60 Q155 62 155 80 Q155 95 140 95 L65 95 Q50 95 50 82 Z" fill="#2B6CB0" opacity="0.8"/><rect x="85" y="100" width="30" height="15" rx="4" fill="#2B6CB0"/><circle cx="100" cy="72" r="8" fill="#fff" opacity="0.4"/></svg>' },
  { id: 'NT-025', name: 'Glow Desk Lamp', price: 69.99, category: 'Smart Home', description: 'Smart LED desk lamp with circadian rhythm and app control', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#319795" opacity="0.12"/><rect x="90" y="90" width="20" height="25" rx="3" fill="#319795"/><rect x="80" y="112" width="40" height="6" rx="3" fill="#319795"/><path d="M100 90 L100 50" stroke="#319795" stroke-width="4" stroke-linecap="round"/><circle cx="100" cy="40" r="18" fill="#319795" opacity="0.3"/><circle cx="100" cy="40" r="10" fill="#319795"/></svg>' },
  { id: 'NT-026', name: 'Atlas Travel Adapter', price: 19.99, category: 'Accessories', description: 'Universal travel adapter with USB-C PD and 4 plug types', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#DD6B20" opacity="0.12"/><rect x="70" y="35" width="60" height="70" rx="8" fill="#DD6B20"/><circle cx="100" cy="55" r="10" fill="#fff" opacity="0.3"/><rect x="85" y="75" width="10" height="15" rx="2" fill="#fff" opacity="0.5"/><rect x="105" y="75" width="10" height="15" rx="2" fill="#fff" opacity="0.5"/><rect x="92" y="105" width="16" height="6" rx="3" fill="#fff" opacity="0.4"/></svg>' },
  { id: 'NT-027', name: 'Ripple BT Speaker', price: 59.99, category: 'Audio', description: 'Waterproof portable Bluetooth speaker with 360-degree sound', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#805AD5" opacity="0.12"/><rect x="70" y="35" width="60" height="70" rx="30" fill="#805AD5"/><circle cx="100" cy="60" r="15" fill="#fff" opacity="0.3"/><circle cx="100" cy="60" r="8" fill="#805AD5"/><rect x="85" y="85" width="30" height="8" rx="4" fill="#fff" opacity="0.3"/></svg>' },
  { id: 'NT-028', name: 'Tracker GPS Tag', price: 29.99, category: 'Accessories', description: 'Ultra-thin GPS tracker with 1-year battery life', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#DD6B20" opacity="0.12"/><circle cx="100" cy="65" r="30" fill="#DD6B20"/><circle cx="100" cy="65" r="20" fill="#fff" opacity="0.2"/><circle cx="100" cy="58" r="5" fill="#fff" opacity="0.6"/><path d="M100 63 L100 78" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.6"/></svg>' },
  { id: 'NT-029', name: 'Slate Drawing Tablet', price: 179.99, category: 'Input', description: '10-inch drawing tablet with built-in screen and 8192 pressure levels', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#D69E2E" opacity="0.12"/><rect x="40" y="30" width="120" height="80" rx="8" fill="#D69E2E"/><rect x="48" y="38" width="104" height="60" rx="4" fill="#fff" opacity="0.25"/><path d="M70 75 Q85 50 100 70 Q115 90 130 65" stroke="#fff" stroke-width="2" fill="none" opacity="0.6"/><circle cx="155" cy="35" r="4" fill="#D69E2E"/></svg>' },
  { id: 'NT-030', name: 'Halo Ring Light', price: 49.99, category: 'Cameras', description: '12-inch ring light with phone mount and remote control', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#E53E3E" opacity="0.12"/><circle cx="100" cy="65" r="35" fill="none" stroke="#E53E3E" stroke-width="10"/><circle cx="100" cy="65" r="8" fill="#E53E3E"/><rect x="97" y="100" width="6" height="20" rx="2" fill="#E53E3E"/><rect x="85" y="118" width="30" height="6" rx="3" fill="#E53E3E"/></svg>' },
  { id: 'NT-031', name: 'Comet Wi-Fi Extender', price: 49.99, category: 'Networking', description: 'Wi-Fi 6 range extender with plug-in design', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#00B5D8" opacity="0.12"/><rect x="75" y="50" width="50" height="60" rx="6" fill="#00B5D8"/><rect x="85" y="110" width="12" height="12" rx="2" fill="#00B5D8"/><rect x="103" y="110" width="12" height="12" rx="2" fill="#00B5D8"/><path d="M85 55 Q100 35 115 55" stroke="#fff" stroke-width="2" fill="none" opacity="0.5"/><path d="M80 50 Q100 25 120 50" stroke="#fff" stroke-width="2" fill="none" opacity="0.3"/><circle cx="110" cy="75" r="4" fill="#fff" opacity="0.5"/></svg>' },
  { id: 'NT-032', name: 'Frost Mini Cooler', price: 89.99, category: 'Smart Home', description: 'USB-powered desktop cooler with app-controlled temperature', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#319795" opacity="0.12"/><rect x="65" y="35" width="70" height="70" rx="10" fill="#319795"/><rect x="75" y="45" width="50" height="35" rx="4" fill="#fff" opacity="0.25"/><path d="M90 58 L100 48 L110 58" stroke="#fff" stroke-width="2" fill="none"/><rect x="85" y="88" width="30" height="8" rx="4" fill="#fff" opacity="0.3"/></svg>' },
  { id: 'NT-033', name: 'Lynx Security Camera', price: 79.99, category: 'Cameras', description: 'Outdoor security camera with 2K resolution and 2-way audio', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#E53E3E" opacity="0.12"/><circle cx="100" cy="55" r="25" fill="#E53E3E"/><circle cx="100" cy="55" r="15" fill="#fff" opacity="0.3"/><circle cx="100" cy="55" r="8" fill="#E53E3E"/><circle cx="100" cy="55" r="3" fill="#fff"/><rect x="90" y="80" width="20" height="30" rx="4" fill="#E53E3E"/><rect x="80" y="108" width="40" height="6" rx="3" fill="#E53E3E" opacity="0.5"/></svg>' },
  { id: 'NT-034', name: 'Tide Waterproof Pouch', price: 14.99, category: 'Accessories', description: 'Universal waterproof phone pouch rated IPX8', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#DD6B20" opacity="0.12"/><rect x="70" y="25" width="60" height="90" rx="12" fill="#DD6B20" opacity="0.3"/><rect x="78" y="35" width="44" height="70" rx="8" fill="#DD6B20"/><rect x="86" y="43" width="28" height="50" rx="4" fill="#fff" opacity="0.25"/><path d="M90 20 Q100 10 110 20" stroke="#DD6B20" stroke-width="3" fill="none"/></svg>' },
  { id: 'NT-035', name: 'Stratos Drone Mini', price: 129.99, category: 'Cameras', description: 'Foldable mini drone with 1080p camera and GPS return', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#E53E3E" opacity="0.12"/><rect x="85" y="55" width="30" height="30" rx="6" fill="#E53E3E"/><line x1="85" y1="60" x2="55" y2="45" stroke="#E53E3E" stroke-width="3"/><line x1="115" y1="60" x2="145" y2="45" stroke="#E53E3E" stroke-width="3"/><line x1="85" y1="80" x2="55" y2="95" stroke="#E53E3E" stroke-width="3"/><line x1="115" y1="80" x2="145" y2="95" stroke="#E53E3E" stroke-width="3"/><circle cx="55" cy="45" r="12" fill="none" stroke="#E53E3E" stroke-width="2" opacity="0.5"/><circle cx="145" cy="45" r="12" fill="none" stroke="#E53E3E" stroke-width="2" opacity="0.5"/><circle cx="55" cy="95" r="12" fill="none" stroke="#E53E3E" stroke-width="2" opacity="0.5"/><circle cx="145" cy="95" r="12" fill="none" stroke="#E53E3E" stroke-width="2" opacity="0.5"/><circle cx="100" cy="70" r="5" fill="#fff" opacity="0.5"/></svg>' },
  { id: 'NT-036', name: 'Ember Heated Mug', price: 69.99, category: 'Smart Home', description: 'Temperature-controlled smart mug with 3-hour battery', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#319795" opacity="0.12"/><rect x="70" y="40" width="50" height="60" rx="6" fill="#319795"/><rect x="120" y="55" width="15" height="30" rx="7" fill="none" stroke="#319795" stroke-width="3"/><path d="M80 35 Q85 25 90 35" stroke="#319795" stroke-width="2" fill="none" opacity="0.4"/><path d="M95 30 Q100 20 105 30" stroke="#319795" stroke-width="2" fill="none" opacity="0.4"/><rect x="65" y="100" width="60" height="6" rx="3" fill="#319795"/></svg>' },
  { id: 'NT-037', name: 'Polaris Smart Plug', price: 12.99, category: 'Smart Home', description: 'Wi-Fi smart plug with energy monitoring and scheduling', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#319795" opacity="0.12"/><rect x="70" y="40" width="60" height="50" rx="8" fill="#319795"/><rect x="80" y="90" width="15" height="18" rx="3" fill="#319795"/><rect x="105" y="90" width="15" height="18" rx="3" fill="#319795"/><circle cx="100" cy="60" r="10" fill="#fff" opacity="0.3"/><circle cx="100" cy="60" r="4" fill="#fff" opacity="0.6"/></svg>' },
  { id: 'NT-038', name: 'Reverb Studio Mic', price: 119.99, category: 'Audio', description: 'USB condenser microphone for streaming and podcasts', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#805AD5" opacity="0.12"/><rect x="85" y="25" width="30" height="55" rx="15" fill="#805AD5"/><rect x="92" y="35" width="16" height="20" rx="3" fill="#fff" opacity="0.3"/><path d="M75 60 Q75 85 100 85 Q125 85 125 60" stroke="#805AD5" stroke-width="3" fill="none"/><rect x="97" y="85" width="6" height="18" rx="2" fill="#805AD5"/><rect x="82" y="103" width="36" height="8" rx="4" fill="#805AD5"/></svg>' },
  { id: 'NT-039', name: 'Nexus NAS Drive', price: 299.99, category: 'Storage', description: '2-bay NAS with RAID support and media server', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#2B6CB0" opacity="0.12"/><rect x="60" y="30" width="80" height="80" rx="8" fill="#2B6CB0"/><rect x="70" y="38" width="30" height="65" rx="4" fill="#fff" opacity="0.2"/><rect x="105" y="38" width="30" height="65" rx="4" fill="#fff" opacity="0.2"/><circle cx="85" cy="90" r="4" fill="#fff" opacity="0.5"/><circle cx="120" cy="90" r="4" fill="#fff" opacity="0.5"/><rect x="75" y="50" width="20" height="3" rx="1" fill="#fff" opacity="0.4"/><rect x="110" y="50" width="20" height="3" rx="1" fill="#fff" opacity="0.4"/></svg>' },
  { id: 'NT-040', name: 'Cipher Privacy Screen', price: 24.99, category: 'Accessories', description: 'Anti-glare privacy screen filter for 13-16 inch laptops', svg: '<svg viewBox="0 0 200 140"><rect width="200" height="140" rx="8" fill="#DD6B20" opacity="0.12"/><rect x="40" y="30" width="120" height="75" rx="6" fill="#DD6B20"/><rect x="48" y="38" width="104" height="58" rx="3" fill="#fff" opacity="0.15"/><line x1="48" y1="38" x2="152" y2="96" stroke="#DD6B20" stroke-width="1" opacity="0.3"/><line x1="48" y1="58" x2="132" y2="96" stroke="#DD6B20" stroke-width="1" opacity="0.3"/><line x1="68" y1="38" x2="152" y2="76" stroke="#DD6B20" stroke-width="1" opacity="0.3"/><line x1="88" y1="38" x2="152" y2="56" stroke="#DD6B20" stroke-width="1" opacity="0.3"/><line x1="48" y1="78" x2="112" y2="96" stroke="#DD6B20" stroke-width="1" opacity="0.3"/><rect x="80" y="105" width="40" height="5" rx="2" fill="#DD6B20"/></svg>' },
];

function getProduct(id) {
  return products.find(function(p) { return p.id === id; });
}

function getRelatedProducts(id, max) {
  var product = getProduct(id);
  if (!product) return [];
  return products.filter(function(p) { return p.category === product.category && p.id !== id; }).slice(0, max || 4);
}

// ================================================================
// Cart (localStorage-backed)
// ================================================================
var CART_KEY = 'relevaltech-cart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch(e) { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(id, qty) {
  var cart = getCart();
  var existing = cart.find(function(item) { return item.productId === id; });
  if (existing) {
    existing.quantity += (qty || 1);
  } else {
    cart.push({ productId: id, quantity: qty || 1 });
  }
  saveCart(cart);
  var product = getProduct(id);
  if (product) showToast('Added ' + product.name + ' to cart');
}

function removeFromCart(id) {
  var cart = getCart().filter(function(item) { return item.productId !== id; });
  saveCart(cart);
}

function updateQuantity(id, qty) {
  var cart = getCart();
  var item = cart.find(function(i) { return i.productId === id; });
  if (item) {
    item.quantity = Math.max(1, Math.min(99, qty));
    saveCart(cart);
  }
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
}

function getCartCount() {
  return getCart().reduce(function(sum, item) { return sum + item.quantity; }, 0);
}

function getCartTotal() {
  return getCart().reduce(function(sum, item) {
    var p = getProduct(item.productId);
    return sum + (p ? p.price * item.quantity : 0);
  }, 0);
}

function updateCartBadge() {
  var badge = document.getElementById('cart-badge');
  if (badge) {
    var count = getCartCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

// ================================================================
// Product Card HTML Generator
// ================================================================
function renderProductCard(product, position, options) {
  options = options || {};
  var linkHref = 'product.html?id=' + product.id;
  var cardClass = options.small ? 'product-card product-card-small' : 'product-card';

  // data-object-id + data-ordinal are the tracker's documented result
  // attributes; the surrounding results container carries data-query-id.
  // data-event-* attributes become custom event attributes (category
  // here, and pricing as a parsed JSON object); plain data-* like
  // data-category are never picked up.
  // The add-to-cart button carries data-action-name so the conversion
  // collector routes it through trackResultEvent.
  return '<a href="' + linkHref + '" class="' + cardClass + '" data-product-card data-object-id="' + product.id +
    '" data-ordinal="' + position + '" data-category="' + product.category + '" data-event-category="' + product.category + '" data-event-pricing=\'' + JSON.stringify({ amount: product.price, currency: 'USD' }) + '\'>' +
    product.svg +
    '<span class="category-badge">' + product.category + '</span>' +
    '<h3>' + product.name + '</h3>' +
    '<p class="price">$' + product.price.toFixed(2) + '</p>' +
    (options.small ? '' : '<p class="description">' + product.description + '</p>') +
    '<button class="add-to-cart" data-add-to-cart data-object-id="' + product.id +
    '" data-action-name="add_to_cart" data-ordinal="' + position + '" onclick="event.preventDefault();event.stopPropagation();addToCart(\'' + product.id + '\')">Add to Cart</button>' +
    '</a>';
}

// ================================================================
// Header
// ================================================================
function renderHeader() {
  var header = document.getElementById('site-header');
  if (!header) return;
  var count = getCartCount();
  header.innerHTML =
    '<div class="header-left">' +
      '<a href="index.html" class="brand">RelevalTech</a>' +
      '<nav class="nav-links">' +
        '<a href="index.html">Catalog</a>' +
        '<a href="cart.html">Cart <span id="cart-badge" class="cart-badge" style="display:' + (count > 0 ? 'inline-block' : 'none') + '">' + count + '</span></a>' +
      '</nav>' +
    '</div>';
}

// ================================================================
// Event Log System (persisted in sessionStorage across pages)
// ================================================================
var EVENT_LOG_KEY = 'relevaltech-event-log';

function loadEventLog() {
  try {
    var stored = sessionStorage.getItem(EVENT_LOG_KEY);
    if (!stored) return [];
    return JSON.parse(stored).map(function(e) {
      e.time = new Date(e.time);
      return e;
    });
  } catch(e) { return []; }
}

function saveEventLog() {
  try {
    // Keep last 200 entries to avoid bloating sessionStorage
    var toSave = eventLogEntries.slice(-200);
    sessionStorage.setItem(EVENT_LOG_KEY, JSON.stringify(toSave));
  } catch(e) {}
}

var eventLogEntries = loadEventLog();

function addToEventLog(type, message, data) {
  eventLogEntries.push({ type: type, message: String(message), data: data, time: new Date() });
  saveEventLog();
  renderEventLog();
}

function renderEventLog() {
  var container = document.getElementById('event-log-entries');
  var countEl = document.getElementById('event-count');
  if (!container) return;
  countEl.textContent = eventLogEntries.length;

  var entries = eventLogEntries.slice(-200);
  container.innerHTML = entries.map(function(e) {
    var typeClass = e.type.toLowerCase();
    var detail = '';
    try { detail = JSON.stringify(e.data, null, 2); } catch(err) { detail = String(e.data); }
    var time = e.time.toLocaleTimeString();
    return '<div class="event-entry" onclick="this.classList.toggle(\'expanded\')">' +
      '<div class="entry-header">' +
        '<span class="entry-time">' + time + '</span>' +
        '<span class="entry-type ' + typeClass + '">' + e.type + '</span>' +
        '<span class="entry-action">' + e.message + '</span>' +
      '</div>' +
      '<div class="entry-detail">' + detail + '</div>' +
    '</div>';
  }).join('');
  container.scrollTop = container.scrollHeight;
}

var EVENT_LOG_OPEN_KEY = 'relevaltech-event-log-open';

function initEventLog() {
  // Render any persisted entries immediately
  renderEventLog();

  var panel = document.getElementById('event-log-panel');
  var toggle = document.getElementById('event-log-toggle');
  var clear = document.getElementById('event-log-clear');

  // Restore open/closed state from previous page
  if (panel && sessionStorage.getItem(EVENT_LOG_OPEN_KEY) === '1') {
    panel.classList.add('open');
  }

  if (toggle) {
    toggle.addEventListener('click', function() {
      panel.classList.toggle('open');
      sessionStorage.setItem(EVENT_LOG_OPEN_KEY, panel.classList.contains('open') ? '1' : '0');
    });
  }
  if (clear) {
    clear.addEventListener('click', function() {
      eventLogEntries = [];
      saveEventLog();
      renderEventLog();
    });
  }
}

// ================================================================
// Toast Notifications
// ================================================================
function showToast(message) {
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(function() { toast.classList.add('show'); });
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { toast.remove(); }, 300);
  }, 2000);
}

