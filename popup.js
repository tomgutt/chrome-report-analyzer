document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const results = document.getElementById('results');
  const loadingIndicator = document.querySelector('.loading-indicator');
  const resultsContent = document.querySelector('.results-content');

  // Settings elements
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsDialog = document.getElementById('settingsDialog');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Settings form elements
  const modelType = document.getElementById('modelType');
  const endpoint = document.getElementById('endpoint');
  const apiKey = document.getElementById('apiKey');
  const apiVersion = document.getElementById('apiVersion');
  const deploymentName = document.getElementById('deploymentName');

  // Load saved settings
  chrome.storage.sync.get([
    'modelType',
    'endpoint',
    'apiKey',
    'apiVersion',
    'deploymentName'
  ], function(data) {
    if (data.modelType) modelType.value = data.modelType;
    if (data.endpoint) endpoint.value = data.endpoint;
    if (data.apiKey) apiKey.value = data.apiKey;
    if (data.apiVersion) apiVersion.value = data.apiVersion;
    if (data.deploymentName) deploymentName.value = data.deploymentName;
  });

  // Settings dialog handlers
  settingsBtn.addEventListener('click', () => {
    settingsDialog.style.display = 'flex';
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsDialog.style.display = 'none';
  });

  // Close dialog when clicking outside
  settingsDialog.addEventListener('click', (e) => {
    if (e.target === settingsDialog) {
      settingsDialog.style.display = 'none';
    }
  });

  // Tab handling
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and panes
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      // Add active class to clicked button and corresponding pane
      button.classList.add('active');
      document.getElementById(button.dataset.tab).classList.add('active');
    });
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', () => {
    const settings = {
      modelType: modelType.value,
      endpoint: endpoint.value,
      apiKey: apiKey.value,
      apiVersion: apiVersion.value,
      deploymentName: deploymentName.value
    };

    chrome.storage.sync.set(settings, function() {
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.textContent = 'Settings saved successfully!';
      successMessage.style.color = '#107e3e';
      successMessage.style.textAlign = 'center';
      successMessage.style.padding = '8px';
      
      const footer = document.querySelector('.dialog-footer');
      footer.insertBefore(successMessage, saveSettingsBtn);

      // Remove message after 2 seconds
      setTimeout(() => {
        successMessage.remove();
        settingsDialog.style.display = 'none';
      }, 2000);
    });
  });

  // Check if we're on a LeanIX page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    if (!currentUrl.includes('leanix.net')) {
      analyzeBtn.disabled = true;
      resultsContent.innerHTML = '<p>Please open this extension while viewing a LeanIX report.</p>';
      results.style.display = 'block';
      return;
    }
  });

  analyzeBtn.addEventListener('click', async function() {
    // Show loading state
    analyzeBtn.disabled = true;
    results.style.display = 'block';
    loadingIndicator.style.display = 'block';
    resultsContent.innerHTML = '';

    try {
      // Get the current tab
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      // Send message to content script to get report content
      const response = await chrome.tabs.sendMessage(tab.id, {action: 'analyzeReport'});
      
      // Here you would typically send the response.content to your AI service
      // For now, we'll simulate an analysis response
      await simulateAIAnalysis(response.content);
      
      // Display results
      displayResults([
        {
          title: 'Application XYZ',
          type: 'Application',
          relevance: 0.95,
          reason: 'This application is directly mentioned in the report and appears to be a key system in the discussed process.'
        },
        {
          title: 'Customer Data Service',
          type: 'Interface',
          relevance: 0.85,
          reason: 'The report discusses data flow patterns that heavily involve this service.'
        }
      ]);
    } catch (error) {
      resultsContent.innerHTML = `
        <div class="fact-sheet">
          <p class="error">Error analyzing the report. Please try again or make sure you're viewing a LeanIX report.</p>
        </div>
      `;
    } finally {
      loadingIndicator.style.display = 'none';
      analyzeBtn.disabled = false;
    }
  });

  function displayResults(factSheets) {
    let html = '<h3>Relevant Fact Sheets</h3>';
    
    factSheets.forEach(sheet => {
      html += `
        <div class="fact-sheet">
          <h3>${sheet.title}</h3>
          <p><strong>Type:</strong> ${sheet.type}</p>
          <p><strong>Relevance:</strong> ${(sheet.relevance * 100).toFixed(0)}%</p>
          <p><strong>Why relevant:</strong> ${sheet.reason}</p>
        </div>
      `;
    });

    resultsContent.innerHTML = html;
  }

  // Simulate AI analysis delay
  function simulateAIAnalysis() {
    return new Promise(resolve => setTimeout(resolve, 2000));
  }
});
