export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  color: string;
};

const categoryColors: Record<string, string> = {
  Audio: '#805AD5',
  Wearables: '#38A169',
  Tablets: '#3182CE',
  Accessories: '#DD6B20',
  Cameras: '#E53E3E',
  Storage: '#2B6CB0',
  Input: '#D69E2E',
  Networking: '#00B5D8',
  'Smart Home': '#319795',
};

export const products: Product[] = [
  { id: 'NT-001', name: 'Quantum Earbuds',              price: 79.99,  category: 'Audio',       description: 'Wireless earbuds with quantum noise cancellation', color: categoryColors.Audio },
  { id: 'NT-002', name: 'Photon Smart Watch',            price: 249.99, category: 'Wearables',   description: 'Solar-powered smartwatch with health tracking', color: categoryColors.Wearables },
  { id: 'NT-003', name: 'NebulaPad Pro',                 price: 599.99, category: 'Tablets',     description: '12-inch tablet with holographic display', color: categoryColors.Tablets },
  { id: 'NT-004', name: 'Pulse Fitness Band',            price: 49.99,  category: 'Wearables',   description: 'Lightweight fitness tracker with heart rate monitoring', color: categoryColors.Wearables },
  { id: 'NT-005', name: 'Echo Speaker Mini',             price: 39.99,  category: 'Audio',       description: 'Compact smart speaker with room-filling sound', color: categoryColors.Audio },
  { id: 'NT-006', name: 'Vortex Wireless Charger',       price: 34.99,  category: 'Accessories', description: 'Fast wireless charger with alignment magnets', color: categoryColors.Accessories },
  { id: 'NT-007', name: 'Zenith Noise-Cancel Headphones', price: 199.99, category: 'Audio',      description: 'Over-ear headphones with adaptive ANC', color: categoryColors.Audio },
  { id: 'NT-008', name: 'Prism 4K Webcam',               price: 89.99,  category: 'Cameras',     description: '4K webcam with auto-framing AI', color: categoryColors.Cameras },
  { id: 'NT-009', name: 'Orbit Portable SSD',            price: 129.99, category: 'Storage',     description: '1TB portable SSD, shock-resistant design', color: categoryColors.Storage },
  { id: 'NT-010', name: 'Flux USB-C Hub',                price: 59.99,  category: 'Accessories', description: '7-in-1 USB-C hub with 4K HDMI output', color: categoryColors.Accessories },
  { id: 'NT-011', name: 'Aether Smart Glasses',          price: 399.99, category: 'Wearables',   description: 'AR-enabled smart glasses, ultra-lightweight', color: categoryColors.Wearables },
  { id: 'NT-012', name: 'Nova Mechanical Keyboard',       price: 149.99, category: 'Input',       description: 'Hot-swappable mechanical keyboard with RGB lighting', color: categoryColors.Input },
  { id: 'NT-013', name: 'Drift Gaming Mouse',            price: 69.99,  category: 'Input',       description: 'Ultra-light gaming mouse with 25K DPI sensor', color: categoryColors.Input },
  { id: 'NT-014', name: 'Beacon Mesh Router',            price: 179.99, category: 'Networking',  description: 'Wi-Fi 7 mesh router with whole-home coverage', color: categoryColors.Networking },
  { id: 'NT-015', name: 'Spark Power Bank',              price: 44.99,  category: 'Accessories', description: '20000mAh power bank with fast charging', color: categoryColors.Accessories },
  { id: 'NT-016', name: 'Clarity Monitor Light',         price: 54.99,  category: 'Accessories', description: 'Monitor light bar with adjustable color temperature', color: categoryColors.Accessories },
  { id: 'NT-017', name: 'Wave Smart Thermostat',         price: 129.99, category: 'Smart Home',  description: 'AI-learning thermostat with energy savings', color: categoryColors['Smart Home'] },
  { id: 'NT-018', name: 'Shield Dash Cam',               price: 99.99,  category: 'Cameras',     description: '1440p dash cam with night vision', color: categoryColors.Cameras },
  { id: 'NT-019', name: 'Zen Air Purifier',              price: 159.99, category: 'Smart Home',  description: 'HEPA air purifier with app control', color: categoryColors['Smart Home'] },
  { id: 'NT-020', name: 'Bolt Cable Set',                price: 24.99,  category: 'Accessories', description: 'Braided USB-C cables, 3-pack assorted lengths', color: categoryColors.Accessories },
  { id: 'NT-021', name: 'Sonic Soundbar',               price: 149.99, category: 'Audio',       description: 'Slim soundbar with Dolby Atmos and wireless subwoofer', color: categoryColors.Audio },
  { id: 'NT-022', name: 'Horizon VR Headset',           price: 349.99, category: 'Wearables',   description: 'Standalone VR headset with 4K per eye and hand tracking', color: categoryColors.Wearables },
  { id: 'NT-023', name: 'Pixel Stylus Pen',             price: 29.99,  category: 'Input',       description: 'Pressure-sensitive stylus with tilt detection and palm rejection', color: categoryColors.Input },
  { id: 'NT-024', name: 'Nimbus Cloud Hub',             price: 199.99, category: 'Storage',     description: 'Personal cloud storage hub with 4TB and remote access', color: categoryColors.Storage },
  { id: 'NT-025', name: 'Glow Desk Lamp',               price: 69.99,  category: 'Smart Home',  description: 'Smart LED desk lamp with circadian rhythm and app control', color: categoryColors['Smart Home'] },
  { id: 'NT-026', name: 'Atlas Travel Adapter',         price: 19.99,  category: 'Accessories', description: 'Universal travel adapter with USB-C PD and 4 plug types', color: categoryColors.Accessories },
  { id: 'NT-027', name: 'Ripple BT Speaker',            price: 59.99,  category: 'Audio',       description: 'Waterproof portable Bluetooth speaker with 360-degree sound', color: categoryColors.Audio },
  { id: 'NT-028', name: 'Tracker GPS Tag',              price: 29.99,  category: 'Accessories', description: 'Ultra-thin GPS tracker with 1-year battery life', color: categoryColors.Accessories },
  { id: 'NT-029', name: 'Slate Drawing Tablet',         price: 179.99, category: 'Input',       description: '10-inch drawing tablet with built-in screen and 8192 pressure levels', color: categoryColors.Input },
  { id: 'NT-030', name: 'Halo Ring Light',              price: 49.99,  category: 'Cameras',     description: '12-inch ring light with phone mount and remote control', color: categoryColors.Cameras },
  { id: 'NT-031', name: 'Comet Wi-Fi Extender',         price: 49.99,  category: 'Networking',  description: 'Wi-Fi 6 range extender with plug-in design', color: categoryColors.Networking },
  { id: 'NT-032', name: 'Frost Mini Cooler',            price: 89.99,  category: 'Smart Home',  description: 'USB-powered desktop cooler with app-controlled temperature', color: categoryColors['Smart Home'] },
  { id: 'NT-033', name: 'Lynx Security Camera',         price: 79.99,  category: 'Cameras',     description: 'Outdoor security camera with 2K resolution and 2-way audio', color: categoryColors.Cameras },
  { id: 'NT-034', name: 'Tide Waterproof Pouch',        price: 14.99,  category: 'Accessories', description: 'Universal waterproof phone pouch rated IPX8', color: categoryColors.Accessories },
  { id: 'NT-035', name: 'Stratos Drone Mini',           price: 129.99, category: 'Cameras',     description: 'Foldable mini drone with 1080p camera and GPS return', color: categoryColors.Cameras },
  { id: 'NT-036', name: 'Ember Heated Mug',             price: 69.99,  category: 'Smart Home',  description: 'Temperature-controlled smart mug with 3-hour battery', color: categoryColors['Smart Home'] },
  { id: 'NT-037', name: 'Polaris Smart Plug',           price: 12.99,  category: 'Smart Home',  description: 'Wi-Fi smart plug with energy monitoring and scheduling', color: categoryColors['Smart Home'] },
  { id: 'NT-038', name: 'Reverb Studio Mic',            price: 119.99, category: 'Audio',       description: 'USB condenser microphone for streaming and podcasts', color: categoryColors.Audio },
  { id: 'NT-039', name: 'Nexus NAS Drive',              price: 299.99, category: 'Storage',     description: '2-bay NAS with RAID support and media server', color: categoryColors.Storage },
  { id: 'NT-040', name: 'Cipher Privacy Screen',        price: 24.99,  category: 'Accessories', description: 'Anti-glare privacy screen filter for 13-16 inch laptops', color: categoryColors.Accessories },
];

export const categories = [...new Set(products.map(p => p.category))];
