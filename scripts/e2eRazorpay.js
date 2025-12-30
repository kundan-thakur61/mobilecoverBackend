(async ()=>{
  const base = 'http://localhost:4000';
  const fetch = globalThis.fetch || require('node-fetch');
  const { execFileSync } = require('child_process');

  try {
    console.log('Registering user (razor)...');
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Razor User', email: 'sim-razor@example.com', password: 'Password123!', phone: '9999990000' })
    });
    const regText = await reg.text();
    console.log('Register:', reg.status, regText);

    try {
      console.log('Promoting to admin...');
      execFileSync('node', [__dirname + '/promoteToAdmin.js', 'sim-razor@example.com'], { stdio: 'inherit' });
    } catch (e) {
      console.log('Promote script error (non-fatal):', e.message);
    }

    console.log('Logging in...');
    const login = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'sim-razor@example.com', password: 'Password123!' })
    });
    const loginBody = await login.json().catch(() => null);
    console.log('Login:', login.status, JSON.stringify(loginBody));
    const token = loginBody?.data?.token;
    if (!token) {
      console.error('No token received, aborting.');
      process.exit(1);
    }

    console.log('Creating product with initial variant (unique sku)...');
    const uniqueSku = 'SIMRAZ-' + Date.now();
    const prodResp = await fetch(base + '/api/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        title: 'RazorProd',
        brand: 'RazorBrand',
        model: 'RZ1',
        type: 'Glossy Metal',
        description: 'Product description long enough for validation',
        category: 'Plain',
        featured: false,
        variants: [{ color: 'Silver', price: 599, stock: 10, sku: uniqueSku }]
      })
    });
    const prodBody = await prodResp.json().catch(() => null);
    console.log('Product create:', prodResp.status, JSON.stringify(prodBody));
    const prodId = prodBody?.data?.product?._id;
    const varId = prodBody?.data?.product?.variants?.[0]?._id;
    if (!prodId || !varId) { console.error('No product/variant id, aborting.'); process.exit(1); }

    console.log('Placing razorpay order (paymentMethod: razorpay)...');
    const orderPayload = {
      items: [ { productId: prodId, variantId: varId, quantity: 1 } ],
      total: 599,
      paymentMethod: 'razorpay',
      shippingAddress: { name: 'Razor User', phone: '9999990000', address1: '123 St', city: 'City', state: 'ST', postalCode: '12345', country: 'India' }
    };

    const orderResp = await fetch(base + '/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(orderPayload)
    });
    const orderText = await orderResp.text();
    console.log('Order response:', orderResp.status, orderText);

    // If order created and razorpayOrderId returned, try createPaymentOrder endpoint as well
    try {
      const orderJson = JSON.parse(orderText);
      const razorpayId = orderJson?.data?.order?.payment?.razorpayOrderId || orderJson?.data?.razorpayOrderId;
      if (razorpayId) {
        console.log('Razorpay order id on server:', razorpayId);
      } else {
        console.log('No razorpayOrderId returned in order creation response. You can call /api/pay/create with the order id.');
      }
    } catch (e) {
      // ignore
    }

  } catch (err) {
    console.error('Script error:', err);
    process.exit(1);
  }
})();
