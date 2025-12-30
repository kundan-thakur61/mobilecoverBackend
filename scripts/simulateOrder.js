const { execSync } = require('child_process');
const path = require('path');

const base = process.env.BASE_URL || 'http://localhost:4000';
const email = 'sim@example.com';
const password = 'Password123!';

async function reqJson(url, method = 'GET', token = null, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    try { return { ok: res.ok, data: JSON.parse(text) }; } catch (e) { return { ok: res.ok, data: text }; }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

console.log('Base URL:', base);

(async () => {
  console.log('\n1) Registering user...');
  let r = await reqJson(`${base}/api/auth/register`, 'POST', null, { name: 'Sim User', email, password, phone: '9999999999' });
  console.log(r.data);

  console.log('\n2) Promoting user to admin...');
  try {
    execSync(`node "${path.join(__dirname, 'promoteToAdmin.js')}" ${email}`, { stdio: 'inherit' });
  } catch (e) {
    console.log('Promote script error (may be OK if user not yet created):', e.message);
  }

  console.log('\n3) Logging in to get token...');
  r = await reqJson(`${base}/api/auth/login`, 'POST', null, { email, password });
  if (!r.ok) { console.error('Login failed:', r.data || r.error); process.exit(1); }
  const token = r.data.data && r.data.data.token ? r.data.data.token : null;
  console.log('Token obtained:', !!token);
  if (!token) { process.exit(1); }

  console.log('\n4) Creating a sample product...');
  const productPayload = { title: 'Simulated Product', brand: 'SimBrand', model: 'SB-1', type: 'Glossy Metal', description: 'A sample product created for testing order flow', category: 'Plain', featured: false };
  r = await reqJson(`${base}/api/products`, 'POST', token, productPayload);
  if (!r.ok) { console.error('Product creation failed:', r.data); process.exit(1); }
  const product = r.data.data && r.data.data.product ? r.data.data.product : r.data.data || r.data;
  console.log('Product created:', product._id || product.id);

  console.log('\n5) Adding variant to product...');
  const variantPayload = { color: 'Black', price: 499, stock: 10, sku: 'SIM-BLK-001' };
  r = await reqJson(`${base}/api/products/${product._id}/variants`, 'POST', token, variantPayload);
  if (!r.ok) { console.error('Add variant failed:', r.data); process.exit(1); }
  const variant = r.data.data && r.data.data.variant ? r.data.data.variant : (r.data || r.data);
  console.log('Variant added:', variant._id || variant.id);

  console.log('\n6) Placing COD order...');
  const orderPayload = {
    items: [{ productId: product._id, variantId: variant._id, quantity: 1, price: variant.price }],
    total: variant.price,
    paymentMethod: 'cod',
    shippingAddress: { name: 'Sim User', phone: '9999999999', address1: '123 Test St', address2: '', city: 'TestCity', state: 'TS', postalCode: '12345', country: 'India' }
  };
  r = await reqJson(`${base}/api/orders`, 'POST', token, orderPayload);
  if (!r.ok) { console.error('Order create failed:', r.data); process.exit(1); }
  console.log('Order create response:', r.data);
  const ord = r.data.data && r.data.data.order ? r.data.data.order : r.data.data || r.data;

  console.log('\n7) Attempting Razorpay create payment order...');
  r = await reqJson(`${base}/api/orders/pay/create`, 'POST', token, { orderId: ord._id || ord.id });
  console.log('Razorpay create response:', r.data || r.error);

  console.log('\nSimulation completed.');
})();

// 2) Promote to admin (run script)
console.log('\n2) Promoting user to admin...');
try {
  execSync(`node "${path.join(__dirname, 'promoteToAdmin.js')}" ${email}`, { stdio: 'inherit' });
} catch (e) {
  console.log('Promote script output/error:', e.message);
}

// 3) Login
console.log('\n3) Logging in to get token...');
r = runCurl(`curl -s -X POST "${base}/api/auth/login" -H "Content-Type: application/json" -d '{"email":"${email}","password":"${password}"}'`);
if (!r.success) {
  console.error('Login failed:', r.stderr || r.error);
  process.exit(1);
}
const token = r.data.data && r.data.data.token ? r.data.data.token : null;
console.log('Token obtained:', !!token);

if (!token) {
  console.error('No token available; aborting.');
  process.exit(1);
}

// 4) Create a product
console.log('\n4) Creating a sample product...');
const productPayload = JSON.stringify({
  title: 'Simulated Product',
  brand: 'SimBrand',
  model: 'SB-1',
  type: 'Glossy Metal',
  description: 'A sample product created for testing order flow',
  category: 'Plain',
  featured: false
});

r = runCurl(`curl -s -X POST "${base}/api/products" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '${productPayload}'`);
if (!r.success) { console.error('Product create failed:', r.stderr || r.error); process.exit(1); }
const product = r.data.data && r.data.data.product ? r.data.data.product : r.data.data || r.data;
console.log('Product created:', product._id || product.id);

// 5) Add variant
console.log('\n5) Adding variant to product...');
const variantPayload = JSON.stringify({ color: 'Black', price: 499, stock: 10, sku: 'SIM-BLK-001' });

r = runCurl(`curl -s -X POST "${base}/api/products/${product._id}/variants" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '${variantPayload}'`);
if (!r.success) { console.error('Add variant failed:', r.stderr || r.error); process.exit(1); }
const variant = r.data.data && r.data.data.variant ? r.data.data.variant : (r.data || r.data);
console.log('Variant added:', variant._id || variant.id);

// 6) Place COD order
console.log('\n6) Placing COD order...');
const orderPayload = JSON.stringify({
  items: [{ productId: product._id, variantId: variant._id, quantity: 1, price: variant.price }],
  total: variant.price,
  paymentMethod: 'cod',
  shippingAddress: {
    name: 'Sim User',
    phone: '9999999999',
    address1: '123 Test St',
    address2: '',
    city: 'TestCity',
    state: 'TS',
    postalCode: '12345',
    country: 'India'
  }
});

r = runCurl(`curl -s -X POST "${base}/api/orders" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '${orderPayload}'`);
if (!r.success) { console.error('Order create failed:', r.stderr || r.error); process.exit(1); }
console.log('Order create response:', JSON.stringify(r.data, null, 2));
const ord = r.data.data && r.data.data.order ? r.data.data.order : r.data.data || r.data;

// 7) Attempt Razorpay flow (create server-side Razorpay order)
console.log('\n7) Attempting Razorpay create payment order...');
const payResp = runCurl(`curl -s -X POST "${base}/api/orders/pay/create" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '{"orderId":"${ord._id || ord.id}"}'`);
console.log(payResp.success ? JSON.stringify(payResp.data, null, 2) : (payResp.stderr || payResp.error));

console.log('\nSimulation completed.');
