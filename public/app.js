/**
 * EVID-DGC - Blockchain Evidence Management System
 * Main application logic
 */

let userAccount;

const roleNames = {
    1: 'Public Viewer',
    2: 'Investigator',
    3: 'Forensic Analyst',
    4: 'Legal Professional',
    5: 'Court Official',
    6: 'Evidence Manager',
    7: 'Auditor',
    8: 'Administrator'
};

const roleMapping = {
    1: 'public_viewer',
    2: 'investigator',
    3: 'forensic_analyst',
    4: 'legal_professional',
    5: 'court_official',
    6: 'evidence_manager',
    7: 'auditor',
    8: 'admin'
};

document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    initializeLucideIcons();
    initializeNavigation();
    initializeRoleSelection();
    initializeScrollUp();
});

function initializeLucideIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

async function initializeApp() {
    const connectBtn = document.getElementById('connectWallet');
    const regForm = document.getElementById('registrationForm');
    const dashBtn = document.getElementById('goToDashboard');

    if (connectBtn) connectBtn.addEventListener('click', connectWallet);
    if (regForm) regForm.addEventListener('submit', handleRegistration);
    if (dashBtn) dashBtn.addEventListener('click', goToDashboard);

    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (error) {
            console.log('MetaMask not connected');
        }
    }
}

function initializeNavigation() {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');

            const icon = menuToggle.querySelector('i');
            if (navMenu.classList.contains('active')) {
                icon.setAttribute('data-lucide', 'x');
            } else {
                icon.setAttribute('data-lucide', 'menu');
            }
            lucide.createIcons();
        });

        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                icon.setAttribute('data-lucide', 'menu');
                lucide.createIcons();
            });
        });

        document.addEventListener('click', (e) => {
            if (!menuToggle.contains(e.target) && !navMenu.contains(e.target)) {
                navMenu.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                icon.setAttribute('data-lucide', 'menu');
                lucide.createIcons();
            }
        });
    }
}


function initializeScrollUp() {
    const scrollBtn = document.getElementById('scrollUpBtn');

    if (scrollBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollBtn.classList.add('visible');
            } else {
                scrollBtn.classList.remove('visible');
            }
        });

        scrollBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

function initializeRoleSelection() {
    const roleCards = document.querySelectorAll('.role-card');
    const userRoleInput = document.getElementById('userRole');
    const comprehensiveFormContainer = document.getElementById('comprehensiveFormContainer');

    roleCards.forEach(card => {
        card.addEventListener('click', () => {
            roleCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            const roleValue = parseInt(card.getAttribute('data-role'));
            if (userRoleInput) {
                userRoleInput.value = roleValue;
            }

            if (window.ComprehensiveRegistration && comprehensiveFormContainer) {
                const formHTML = window.ComprehensiveRegistration.generateRegistrationForm(roleValue);
                comprehensiveFormContainer.innerHTML = formHTML;
                comprehensiveFormContainer.classList.remove('hidden');

                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }

                initializeComprehensiveForm();

                if (userAccount) {
                    const walletField = document.getElementById('walletAddress');
                    if (walletField) {
                        walletField.value = userAccount;
                    }
                }
            }
        });
    });
}

function initializeComprehensiveForm() {
    const form = document.getElementById('comprehensiveRegistrationForm');
    if (!form) return;

    const passwordField = document.getElementById('password');
    if (passwordField) {
        passwordField.addEventListener('input', updatePasswordStrength);
    }

    const confirmPasswordField = document.getElementById('confirmPassword');
    if (confirmPasswordField) {
        confirmPasswordField.addEventListener('input', validatePasswordMatch);
    }

    const usernameField = document.getElementById('username');
    if (usernameField) {
        usernameField.addEventListener('blur', checkUsernameUniqueness);
    }

    if (window.IndianAPIs) {
        window.IndianAPIs.initializeIndianAutocomplete();
    }

    form.addEventListener('submit', handleComprehensiveRegistration);
}

function updatePasswordStrength() {
    const password = document.getElementById('password').value;
    const strengthFill = document.querySelector('.strength-fill');
    const strengthText = document.querySelector('.strength-text');

    if (!strengthFill || !strengthText) return;

    let strength = 0;
    let strengthLabel = 'Very Weak';

    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    strengthFill.className = 'strength-fill';
    switch (strength) {
        case 0:
        case 1:
            strengthFill.classList.add('weak');
            strengthLabel = 'Weak';
            break;
        case 2:
            strengthFill.classList.add('fair');
            strengthLabel = 'Fair';
            break;
        case 3:
        case 4:
            strengthFill.classList.add('good');
            strengthLabel = 'Good';
            break;
        case 5:
            strengthFill.classList.add('strong');
            strengthLabel = 'Strong';
            break;
    }

    strengthText.textContent = `Password strength: ${strengthLabel}`;
}

function validatePasswordMatch() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const confirmField = document.getElementById('confirmPassword');

    if (password !== confirmPassword) {
        confirmField.setCustomValidity('Passwords do not match');
    } else {
        confirmField.setCustomValidity('');
    }
}

async function checkUsernameUniqueness() {
    const username = document.getElementById('username').value;
    if (!username) return;

    const existingUsers = Object.keys(localStorage).filter(key =>
        key.startsWith('evidUser_') || key.startsWith('emailUser_')
    );

    let isUnique = true;
    for (const userKey of existingUsers) {
        try {
            const userData = JSON.parse(localStorage.getItem(userKey));
            if (userData.username === username) {
                isUnique = false;
                break;
            }
        } catch (e) {
            // Ignore parsing errors
        }
    }

    const usernameField = document.getElementById('username');
    if (!isUnique) {
        usernameField.setCustomValidity('Username already exists');
        showAlert('Username already exists. Please choose another.', 'error');
    } else {
        usernameField.setCustomValidity('');
    }
}

async function handleComprehensiveRegistration(event) {
    event.preventDefault();

    try {
        showLoading(true, 'Processing registration...');

        const formData = collectFormData();

        if (!validateFormData(formData)) {
            showLoading(false);
            return;
        }

        const userData = {
            ...formData,
            isRegistered: true,
            registrationDate: new Date().toISOString(),
            walletAddress: userAccount,
            verificationStatus: 'pending',
            accountType: 'comprehensive'
        };

        const userKey = userAccount ? 'evidUser_' + userAccount : 'emailUser_' + formData.email;
        localStorage.setItem(userKey, JSON.stringify(userData));
        localStorage.setItem('currentUser', userAccount || 'email_' + formData.email);

        showLoading(false);
        showAlert('Registration submitted successfully!', 'success');

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);

    } catch (error) {
        console.error('Registration failed:', error);
        showLoading(false);
        showAlert('Registration failed. Please try again.', 'error');
    }
}

function collectFormData() {
    const formData = {};
    const form = document.getElementById('comprehensiveRegistrationForm');

    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            if (input.name) {
                if (!formData[input.name]) formData[input.name] = [];
                if (input.checked) formData[input.name].push(input.value);
            } else {
                formData[input.id] = input.checked;
            }
        } else if (input.type !== 'submit') {
            formData[input.id] = input.value;
        }
    });

    return formData;
}

/**
 * Validate registration form values and show the first relevant error alert if validation fails.
 *
 * Checks that required fields (firstName, lastName, email, username, password) are present, that
 * password matches confirmPassword, and that termsAccepted and privacyAccepted are true. If a
 * validation rule fails the function shows an error alert describing the first failure.
 *
 * @param {Object} formData - Collected registration form values (expected keys include `firstName`, `lastName`, `email`, `username`, `password`, `confirmPassword`, `termsAccepted`, `privacyAccepted`).
 * @returns {boolean} `true` if all validations pass, `false` otherwise.
 */
function validateFormData(formData) {
    const requiredFields = ['firstName', 'lastName', 'email', 'username', 'password'];

    for (const field of requiredFields) {
        if (!formData[field]) {
            showAlert(`${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is required.`, 'error');
            return false;
        }
    }

    if (formData.password !== formData.confirmPassword) {
        showAlert('Passwords do not match.', 'error');
        return false;
    }

    if (!formData.termsAccepted || !formData.privacyAccepted) {
        showAlert('You must accept the Terms & Conditions and Privacy Policy.', 'error');
        return false;
    }

    return true;
}

/**
 * Connects the user's Ethereum wallet, updates the UI, and checks or creates the user's registration state.
 *
 * Performs network and provider availability checks, handles a demo fallback, prompts to install MetaMask if absent,
 * requests account access, enforces the configured target network, handles a special admin wallet shortcut,
 * updates the wallet display, and launches the registration status flow. Displays contextual error modals for
 * common wallet/provider failures.
 */
async function connectWallet() {
    closeErrorModal();

    if (!navigator.onLine) {
        showErrorModal('No Internet Connection', 'Please check your network settings and try again.');
        return;
    }

    try {
        showLoading(true);
        const loader = document.getElementById('loader');
        if (loader) loader.classList.remove('hidden');

        if (!window.ethereum) {
            if (config.DEMO_MODE) {
                userAccount = '0x1234567890123456789012345678901234567890';
                await new Promise(resolve => setTimeout(resolve, 1500));
                updateWalletUI();
                await checkRegistrationStatus();
                showLoading(false);
                hideConnectionLoader();
                return;
            }

            showLoading(false);
            hideConnectionLoader();
            showErrorModal(
                'MetaMask Not Found',
                'MetaMask is not installed. Please install it to use this application.',
                'Install MetaMask',
                () => window.open('https://metamask.io/download/', '_blank')
            );
            return;
        }

        if (config.TARGET_CHAIN_ID && !(await checkNetwork())) {
            showLoading(false);
            hideConnectionLoader();
            return;
        }

        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        if (accounts.length === 0) {
            showLoading(false);
            hideConnectionLoader();
            showErrorModal('Account Access Required', 'Please unlock your MetaMask wallet and select an account.');
            return;
        }

        userAccount = accounts[0];

        if (userAccount.toLowerCase() === '0x29bb7718d5c6da6e787deae8fd6bb3459e8539f2'.toLowerCase()) {
            const adminData = {
                fullName: 'Administrator',
                email: 'Gc67766@gmail.com',
                role: 8,
                department: 'Administration',
                jurisdiction: 'System',
                badgeNumber: 'ADMIN-001',
                isRegistered: true,
                registrationDate: new Date().toISOString(),
                walletAddress: userAccount,
                accountType: 'admin'
            };

            localStorage.setItem('evidUser_' + userAccount, JSON.stringify(adminData));
            localStorage.setItem('currentUser', userAccount);

            displayAdminOptions(adminData);
            toggleSections('adminOptions');
            showLoading(false);
            hideConnectionLoader();
            return;
        }

        updateWalletUI();
        await checkRegistrationStatus();

        showLoading(false);
        hideConnectionLoader();

    } catch (error) {
        showLoading(false);
        hideConnectionLoader();
        console.error('Wallet connection error:', error);

        if (error.code === 4001) {
            showErrorModal('Connection Rejected', 'You rejected the connection request. This app requires a wallet connection to function.', 'Try Again', connectWallet);
        } else if (error.code === 4100) {
            showErrorModal('Unauthorized', 'The requested method and/or account has not been authorized by the user. Please check your MetaMask settings.');
        } else if (error.code === 4900) {
            showErrorModal('Disconnected', 'The connection to the blockchain has been lost. Please check your internet connection or MetaMask status.');
        } else if (error.code === -32002) {
            showErrorModal('Check MetaMask', 'A connection request is already pending. Please check your MetaMask extension popups.');
        } else if (error.code === -32603) {
            showErrorModal('Internal Error', 'MetaMask encountered an internal error. Please try resetting your MetaMask account or restarting the browser.');
        } else {
            showErrorModal('Connection Failed', error.message || 'An unexpected error occurred.');
        }
    }
}

function hideConnectionLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');
}

function updateWalletUI() {
    const walletAddr = document.getElementById('walletAddress');
    const walletStatus = document.getElementById('walletStatus');
    const connectBtn = document.getElementById('connectWallet');

    if (walletAddr) {
        walletAddr.textContent = userAccount;
    }

    if (walletStatus) {
        walletStatus.classList.remove('hidden');
    }

    if (connectBtn) {
        connectBtn.innerHTML = '<i data-lucide="check"></i> Connected';
        connectBtn.disabled = true;
        connectBtn.classList.add('btn-success');
        lucide.createIcons();
    }
}

async function checkRegistrationStatus() {
    const savedUser = localStorage.getItem('evidUser_' + userAccount);

    if (savedUser) {
        const userData = JSON.parse(savedUser);
        displayUserInfo(userData);
        toggleSections('alreadyRegistered');
    } else {
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser && currentUser.startsWith('email_')) {
            const emailUser = localStorage.getItem('evidUser_' + currentUser);
            if (emailUser) {
                const userData = JSON.parse(emailUser);
                displayUserInfo(userData);
                toggleSections('alreadyRegistered');
                return;
            }
        }
        toggleSections('registration');
    }
}

function displayAdminOptions(userData) {
    const userName = document.getElementById('adminUserName');
    const userRoleName = document.getElementById('adminUserRoleName');

    if (userName) {
        userName.textContent = userData.fullName || 'Administrator';
    }

    if (userRoleName) {
        userRoleName.textContent = 'Administrator';
    }
}

function goToAdminDashboard() {
    window.location.href = 'admin.html';
}

function displayUserInfo(userData) {
    const userName = document.getElementById('userName');
    const userRoleName = document.getElementById('userRoleName');

    if (userName) {
        userName.textContent = userData.fullName || 'User';
    }

    if (userRoleName) {
        const roleName = typeof userData.role === 'number'
            ? roleNames[userData.role]
            : userData.role.replace('_', ' ').toUpperCase();
        userRoleName.textContent = roleName;
    }
}

function toggleSections(active) {
    const sections = ['wallet', 'registration', 'alreadyRegistered', 'adminOptions'];

    sections.forEach(id => {
        const element = document.getElementById(id + 'Section');
        if (element) {
            element.classList.toggle('hidden', id !== active);
        }
    });
}

async function handleRegistration(event) {
    event.preventDefault();

    try {
        const role = parseInt(document.getElementById('userRole')?.value);
        const fullName = document.getElementById('fullName')?.value;
        const badgeNumber = document.getElementById('badgeNumber')?.value;
        const department = document.getElementById('department')?.value;
        const jurisdiction = document.getElementById('jurisdiction')?.value;

        if (!role || !fullName) {
            showAlert('Please select a role and enter your full name.', 'error');
            return;
        }

        const userData = {
            fullName,
            role,
            badgeNumber: badgeNumber || '',
            department: department || 'General',
            jurisdiction: jurisdiction || 'General',
            isRegistered: true,
            registrationDate: new Date().toISOString(),
            walletAddress: userAccount
        };

        localStorage.setItem('evidUser_' + userAccount, JSON.stringify(userData));
        localStorage.setItem('currentUser', userAccount);

        showAlert('Registration successful! Redirecting to dashboard...', 'success');

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);

    } catch (error) {
        console.error('Registration failed:', error);
        showAlert('Registration failed. Please try again.', 'error');
    }
}

async function goToDashboard() {
    window.location.href = 'dashboard.html';
}

function getUserRole() {
    if (!userAccount) return null;

    const savedUser = localStorage.getItem('evidUser_' + userAccount);
    if (savedUser) {
        const userData = JSON.parse(savedUser);
        return typeof userData.role === 'number'
            ? roleNames[userData.role]
            : userData.role;
    }

    return null;
}

function logout() {
    localStorage.clear();
    userAccount = null;

    const walletStatus = document.getElementById('walletStatus');
    const connectBtn = document.getElementById('connectWallet');

    if (walletStatus) walletStatus.classList.add('hidden');
    if (connectBtn) {
        connectBtn.innerHTML = '<i data-lucide="link"></i> Connect MetaMask';
        connectBtn.disabled = false;
        connectBtn.classList.remove('btn-success');
        lucide.createIcons();
    }

    toggleSections('wallet');
    showAlert('Logged out successfully', 'info');
}

function disconnectWallet() {
    userAccount = null;

    const walletStatus = document.getElementById('walletStatus');
    const walletSection = document.getElementById('walletSection');
    const registrationSection = document.getElementById('registrationSection');
    const alreadyRegisteredSection = document.getElementById('alreadyRegisteredSection');
    const connectBtn = document.getElementById('connectWallet');

    if (walletStatus) walletStatus.classList.add('hidden');
    if (walletSection) walletSection.classList.remove('hidden');
    if (registrationSection) registrationSection.classList.add('hidden');
    if (alreadyRegisteredSection) alreadyRegisteredSection.classList.add('hidden');

    if (connectBtn) {
        connectBtn.innerHTML = '<i data-lucide="link"></i> Connect MetaMask';
        connectBtn.disabled = false;
        connectBtn.classList.remove('btn-success');
        lucide.createIcons();
    }

    showAlert('Wallet disconnected successfully', 'info');
}

function showLoading(show) {
    const modal = document.getElementById('loadingModal');
    if (modal) {
        modal.classList.toggle('active', show);
    }
}

function showAlert(message, type = 'info') {
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="${getAlertIcon(type)}" style="width: 16px; height: 16px;"></i>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(alert);

    lucide.createIcons();

    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);

    alert.addEventListener('click', () => {
        alert.remove();
    });
}

function getAlertIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };
    return icons[type] || 'info';
}

/**
 * Scrolls the page smoothly to the element with the given ID.
 * @param {string} sectionId - The ID of the target DOM element; does nothing if no element with that ID exists.
 */
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

/**
 * Display an error modal with a title, HTML description, and an optional action button.
 *
 * If the expected modal elements exist in the DOM, the function populates the title and
 * description, shows or hides the action button based on `actionText`/`actionCallback`,
 * and activates the modal. If modal elements are missing, falls back to calling
 * `showAlert` with a combined error message.
 *
 * @param {string} title - The modal title text.
 * @param {string} description - The modal description; may include HTML.
 * @param {string|null} [actionText=null] - Text for the optional action button; when null the button is hidden.
 * @param {Function|null} [actionCallback=null] - Callback invoked when the action button is clicked.
 */
function showErrorModal(title, description, actionText = null, actionCallback = null) {
    const modal = document.getElementById('errorModal');
    const titleEl = document.getElementById('errorTitle');
    const descEl = document.getElementById('errorDescription');
    const actionBtn = document.getElementById('errorActionBtn');

    if (modal && titleEl && descEl) {
        titleEl.textContent = title;
        descEl.innerHTML = description;

        if (actionText && actionCallback) {
            actionBtn.textContent = actionText;
            actionBtn.onclick = actionCallback;
            actionBtn.classList.remove('hidden');
        } else {
            actionBtn.classList.add('hidden');
        }
        modal.classList.add('active');
    } else {
        showAlert(`${title}: ${description}`, 'error');
    }
}

/**
 * Closes the error modal if it exists in the DOM.
 *
 * Locates the element with id "errorModal" and removes its "active" class to hide it.
 */
function closeErrorModal() {
    const modal = document.getElementById('errorModal');
    if (modal) modal.classList.remove('active');
}

/**
 * Ensure the connected wallet is on the configured target network.
 *
 * If no Ethereum provider is present or the wallet's chain ID does not match the configured TARGET_CHAIN_ID,
 * a modal is shown prompting the user to switch networks and offering an action that attempts to switch the wallet's chain.
 * If the switch action fails or the network is not available in the wallet, appropriate error modals are displayed.
 *
 * @returns {Promise<boolean>} `true` if the wallet is on the target network, `false` otherwise.
 */
async function checkNetwork() {
    if (!window.ethereum) return false;
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (currentChainId.toLowerCase() !== config.TARGET_CHAIN_ID.toLowerCase()) {
        showErrorModal(
            'Wrong Network',
            `Please switch your wallet to <strong>${config.NETWORK_NAME}</strong> to continue.`,
            `Switch to ${config.NETWORK_NAME}`,
            async () => {
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: config.TARGET_CHAIN_ID }],
                    });
                    closeErrorModal();
                } catch (switchError) {
                    if (switchError.code === 4902) {
                        showErrorModal('Network Not Found', `The ${config.NETWORK_NAME} is not added to your MetaMask. Please add it manually.`);
                    } else {
                        showErrorModal('Switch Failed', 'Failed to switch network. Please try explicitly from your wallet.');
                    }
                }
            }
        );
        return false;
    }
    return true;
}

if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            disconnectWallet();
        } else {
            location.reload();
        }
    });

    window.ethereum.on('chainChanged', () => {
        location.reload();
    });
}

window.EVID_DGC = {
    connectWallet,
    disconnectWallet,
    logout,
    showAlert,
    scrollToSection,
    getUserRole
};