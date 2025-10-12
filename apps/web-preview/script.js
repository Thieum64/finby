// Configuration (embedded in code, not exposed in UI)
const CONFIG = {
  firebaseApiKey: 'AIzaSyCAkDhyGKscztK-t-uBJIewecgdj6LzZXU',
  firebaseProjectId: 'hyperush-dev',
};

let idToken = null;
let userData = null;

// Update status indicator
function updateStatus(connected, text) {
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  if (connected) {
    indicator.classList.add('connected');
  } else {
    indicator.classList.remove('connected');
  }

  statusText.textContent = text;
}

// Update button states based on auth status
function updateButtons(enabled) {
  const buttons = [
    'btnMe',
    'btnTenants',
    'btnRoles',
    'btnCheckAccess',
    'btnAcceptInvite',
  ];
  buttons.forEach((id) => {
    document.getElementById(id).disabled = !enabled;
  });
}

// Display response
function displayResponse(data, isError = false) {
  const responseEl = document.getElementById('response');
  const formatted = JSON.stringify(data, null, 2);
  responseEl.textContent = formatted;
  responseEl.className = isError ? 'error' : 'success';
}

// Display request details
function displayRequest(method, url, headers = {}, body = null) {
  const requestEl = document.getElementById('requestDetails');
  const details = {
    method,
    url,
    headers,
    ...(body && { body }),
  };
  requestEl.textContent = JSON.stringify(details, null, 2);
}

// Copy response to clipboard
function copyResponse() {
  const responseEl = document.getElementById('response');
  navigator.clipboard.writeText(responseEl.textContent).then(() => {
    alert('Response copied to clipboard!');
  });
}

// Sign in with Firebase
async function signIn() {
  try {
    updateStatus(false, 'Signing in...');
    displayResponse({ status: 'Authenticating with Firebase...' });

    // Read credentials from form inputs
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      throw new Error('Please enter both email and password');
    }

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CONFIG.firebaseApiKey}`;

    const body = {
      email,
      password,
      returnSecureToken: true,
    };

    // Display request WITHOUT showing credentials
    displayRequest(
      'POST',
      url,
      {
        'Content-Type': 'application/json',
      },
      { email: email, password: '***' }
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Authentication failed');
    }

    const data = await response.json();
    idToken = data.idToken;
    userData = {
      email: data.email,
      uid: data.localId,
      expiresIn: data.expiresIn,
    };

    updateStatus(true, `Connected as ${userData.email}`);
    updateButtons(true);

    displayResponse({
      success: true,
      message: 'Successfully authenticated with Firebase',
      user: userData,
      tokenLength: idToken.length,
    });
  } catch (error) {
    updateStatus(false, 'Sign in failed');
    updateButtons(false);
    displayResponse(
      {
        error: true,
        message: error.message,
      },
      true
    );
  }
}

// Sign out
function signOut() {
  idToken = null;
  userData = null;
  updateStatus(false, 'Not connected');
  updateButtons(false);
  displayResponse({ message: 'Signed out successfully' });
  displayRequest('N/A', 'N/A');
}

// Get gateway URL from input
function getGatewayUrl() {
  return document.getElementById('gatewayUrl').value.trim();
}

// Make authenticated request
async function makeRequest(
  endpoint,
  method = 'GET',
  body = null,
  requiresAuth = true
) {
  try {
    const gatewayUrl = getGatewayUrl();
    const url = `${gatewayUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth && idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    displayRequest(method, url, headers, body);

    const options = {
      method,
      headers,
      mode: 'cors',
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    displayResponse({
      status: response.status,
      statusText: response.statusText,
      data,
    });

    return data;
  } catch (error) {
    displayResponse(
      {
        error: true,
        message: error.message,
        stack: error.stack,
      },
      true
    );
    throw error;
  }
}

// Test Health endpoint (public)
async function testHealth() {
  await makeRequest('/api/v1/auth/health', 'GET', null, false);
}

// Test Me endpoint (protected)
async function testMe() {
  if (!idToken) {
    alert('Please sign in first');
    return;
  }
  await makeRequest('/api/v1/auth/me', 'GET');
}

// Test Tenants endpoint (protected)
async function testTenants() {
  if (!idToken) {
    alert('Please sign in first');
    return;
  }
  await makeRequest('/api/v1/auth/tenants', 'GET');
}

// Test Roles endpoint (protected)
async function testRoles() {
  if (!idToken) {
    alert('Please sign in first');
    return;
  }

  const tenantId = document.getElementById('tenantId').value.trim();
  if (!tenantId) {
    alert('Please enter a tenant ID');
    return;
  }

  await makeRequest(`/api/v1/auth/tenants/${tenantId}/roles`, 'GET');
}

// Test Check Access endpoint (protected)
async function testCheckAccess() {
  if (!idToken) {
    alert('Please sign in first');
    return;
  }

  const tenantId = document.getElementById('tenantId').value.trim();
  const action = document.getElementById('action').value.trim();

  if (!tenantId) {
    alert('Please enter a tenant ID');
    return;
  }

  if (!action) {
    alert('Please enter an action');
    return;
  }

  await makeRequest(`/api/v1/auth/tenants/${tenantId}/check`, 'POST', {
    action,
  });
}

// Test Accept Invite endpoint (protected)
async function testAcceptInvite() {
  if (!idToken) {
    alert('Please sign in first');
    return;
  }

  const inviteToken = document.getElementById('inviteToken').value.trim();
  if (!inviteToken) {
    alert('Please enter an invite token');
    return;
  }

  await makeRequest('/api/v1/auth/invites/accept', 'POST', {
    token: inviteToken,
  });
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  updateStatus(false, 'Not connected');
  updateButtons(false);

  // Display welcome message
  displayResponse({
    message: 'Welcome to Hyperush API Preview',
    instructions: [
      '1. Click "Sign In" to authenticate with Firebase',
      '2. Test public endpoints like "Health" without authentication',
      '3. Test protected endpoints like "Me", "Tenants" after signing in',
      '4. Enter tenant ID to test tenant-specific endpoints',
      '5. Responses will appear in this panel',
    ],
  });
});

// Expose functions globally for HTML onclick handlers
window.copyResponse = copyResponse;
window.signIn = signIn;
window.signOut = signOut;
window.testHealth = testHealth;
window.testMe = testMe;
window.testTenants = testTenants;
window.testRoles = testRoles;
window.testCheckAccess = testCheckAccess;
window.testAcceptInvite = testAcceptInvite;
