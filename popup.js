import { fillPromptTemplate, generateOutputSchema } from './prompt-template.js';

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
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Settings form elements
  const modelType = document.getElementById('modelType');
  const endpoint = document.getElementById('endpoint');
  const endpointError = document.getElementById('endpointError');
  const apiKey = document.getElementById('apiKey');
  const apiVersion = document.getElementById('apiVersion');
  const deploymentName = document.getElementById('deploymentName');
  const deploymentLabel = document.getElementById('deploymentLabel');
  const modelHelp = document.getElementById('modelHelp');
  const useJsonMode = document.getElementById('useJsonMode');
  const useJsonSchema = document.getElementById('useJsonSchema');
  const useTextMode = document.getElementById('useTextMode');

  // Get parent form groups for conditional display
  const endpointGroup = endpoint.closest('.form-group');
  const apiVersionGroup = apiVersion.closest('.form-group');

  // Report status elements
  const reportStatus = document.getElementById('reportStatus');
  const noReportText = reportStatus.querySelector('.no-report');
  const hasReportText = reportStatus.querySelector('.has-report');
  const reportIdSpan = hasReportText.querySelector('.report-id');
  const reportNameSpan = hasReportText.querySelector('.report-name');
  const reportViewSpan = hasReportText.querySelector('.report-view');
  const mainFilter = hasReportText.querySelector('.main-filter');
  const moreFilters = hasReportText.querySelector('.more-filters');
  const leftProperty = hasReportText.querySelector('.left-property');
  const rightProperty = hasReportText.querySelector('.right-property');
  let currentReportId = null;

  // User prompt input
  const userPromptInput = document.getElementById('userPromptInput');
  const userPromptContainer = document.querySelector('.user-prompt-container');

  // Function to update the UI based on report status
  function updateReportStatus(reportId) {
    currentReportId = reportId;
    if (reportId) {
      // Get all storage data to properly count edges
      chrome.storage.local.get(null, function(data) {
        if (data.reportInfo) {
          const info = data.reportInfo;
          
          // Update basic info
          reportIdSpan.textContent = info.id;
          reportNameSpan.textContent = info.name;
          reportViewSpan.textContent = info.view;
          
          // Get edge counts for each filter type
          const edgeCounts = {};
          Object.keys(data).forEach(key => {
            if (key.startsWith(`edges_${reportId}.`)) {
              const type = key.split('.')[1];
              edgeCounts[type] = data[key].length;
            }
          });
          
          // Update filters with edge counts
          if (info.mainFilter) {
            const mainFilterCount = edgeCounts[info.mainFilter] || 0;
            mainFilter.textContent = `${info.mainFilter} (${mainFilterCount})`;
          } else {
            mainFilter.textContent = 'None';
          }

          if (info.moreFilters.length > 0) {
            moreFilters.innerHTML = info.moreFilters
              .map(filter => {
                const count = edgeCounts[filter] || 0;
                return `<span>${filter} (${count})</span>`;
              })
              .join('');
          } else {
            moreFilters.textContent = 'None';
          }
          
          // Update properties
          leftProperty.textContent = info.properties.left || 'None';
          rightProperty.textContent = info.properties.right || 'None';

          // Show the report info and enable UI elements
          noReportText.style.display = 'none';
          hasReportText.style.display = 'block';
          analyzeBtn.disabled = false;
          userPromptContainer.style.display = 'block';  // Show the user prompt container
        }
      });
    } else {
      noReportText.style.display = 'block';
      hasReportText.style.display = 'none';
      reportIdSpan.textContent = '';
      reportNameSpan.textContent = '';
      reportViewSpan.textContent = '';
      mainFilter.textContent = '';
      moreFilters.innerHTML = '';
      leftProperty.textContent = '';
      rightProperty.textContent = '';
      analyzeBtn.disabled = true;
      userPromptContainer.style.display = 'none';  // Hide the user prompt container
      userPromptInput.value = '';  // Clear the input when hiding
    }
  }

  // Listen for report detection messages from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'reportDetected') {
      // Get current tab URL and verify it matches the report ID
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        if (currentUrl.includes(message.reportId)) {
          updateReportStatus(message.reportId);
        } else {
          console.log('URL does not match report ID, not updating UI');
          updateReportStatus(null);
        }
      });
    }
  });

  // Check initial report status when popup opens
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    if (!currentUrl.includes('leanix.net')) {
      analyzeBtn.disabled = true;
      resultsContent.innerHTML = '<p>Please open this extension while viewing a LeanIX report.</p>';
      results.style.display = 'block';
      return;
    }

    // Test marking a fact sheet, keep for debugging
    // chrome.tabs.sendMessage(tabs[0].id, {
    //   action: 'markFactSheets',
    //   factSheets: [{
    //     id: "123",
    //     name: "AC Management",
    //     reason: "This application has critical technical debt issues and requires immediate attention for modernization."
    //   },
    //   {
    //     id: "456",
    //     name: "Microsoft Teams",
    //     reason: "Nobody likes this application."
    //   }]
    // });

    // Check if we have stored report info
    chrome.storage.local.get('reportInfo', function(data) {
      if (data.reportInfo) {
        // If we have stored info, verify the ID is in the current URL
        if (currentUrl.includes(data.reportInfo.id)) {
          updateReportStatus(data.reportInfo.id);
        } else {
          // Clear the stored info if it doesn't match current URL
          chrome.storage.local.remove('reportInfo');
          updateReportStatus(null);
        }
      } else {
        updateReportStatus(null);
      }
    });
  });

  // Handle provider change
  function updateFormFields() {
    const isOpenAI = modelType.value === 'openai';
    endpointGroup.style.display = isOpenAI ? 'none' : 'block';
    apiVersionGroup.style.display = isOpenAI ? 'none' : 'block';

    // Update deployment/model name field
    if (isOpenAI) {
      deploymentLabel.textContent = 'Model Name';
      deploymentName.placeholder = 'Enter model name';
      modelHelp.textContent = 'e.g. gpt-4o-mini';
      modelHelp.style.display = 'block';
    } else {
      deploymentLabel.textContent = 'Deployment Name';
      deploymentName.placeholder = 'Enter deployment name';
      modelHelp.style.display = 'none';
    }

    // Clear hidden fields when switching to OpenAI
    if (isOpenAI) {
      endpoint.value = '';
      apiVersion.value = '';
    }
  }

  modelType.addEventListener('change', updateFormFields);

  // Handle mutual exclusivity of output mode checkboxes
  [useJsonMode, useJsonSchema, useTextMode].forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        // Uncheck other checkboxes
        [useJsonMode, useJsonSchema, useTextMode].forEach(otherCheckbox => {
          if (otherCheckbox !== e.target) {
            otherCheckbox.checked = false;
          }
        });
      }
    });
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', () => {
    // Validate endpoint before saving
    if (!validateEndpoint()) {
      return; // Don't save if endpoint is invalid (except for OpenAI)
    }

    const settings = {
      modelType: modelType.value,
      endpoint: normalizeEndpoint(endpoint.value),
      apiKey: apiKey.value,
      apiVersion: apiVersion.value,
      deploymentName: deploymentName.value,
      useJsonMode: useJsonMode.checked,
      useJsonSchema: useJsonSchema.checked,
      useTextMode: useTextMode.checked
    };

    chrome.storage.sync.set(settings, function() {
      // Disable all input fields and buttons
      const inputs = settingsDialog.querySelectorAll('input, select, button');
      inputs.forEach(input => input.disabled = true);

      // Show success message
      const successMessage = document.createElement('div');
      successMessage.textContent = 'Settings saved successfully!';
      successMessage.style.color = '#107e3e';
      successMessage.style.textAlign = 'center';
      successMessage.style.padding = '8px';
      
      const footer = document.querySelector('.dialog-footer');
      footer.insertBefore(successMessage, saveSettingsBtn);

      // Remove message and re-enable inputs after 2 seconds
      setTimeout(() => {
        successMessage.remove();
        settingsDialog.style.display = 'none';
        // Re-enable all inputs
        inputs.forEach(input => input.disabled = false);
      }, 2000);
    });
    console.log('Settings saved:', settings);
  });

  // Load saved settings
  chrome.storage.sync.get([
    'modelType',
    'endpoint',
    'apiKey',
    'apiVersion',
    'deploymentName',
    'useJsonMode',
    'useJsonSchema',
    'useTextMode'
  ], function(data) {
    if (data.modelType) modelType.value = data.modelType;
    if (data.endpoint) endpoint.value = data.endpoint;
    if (data.apiKey) apiKey.value = data.apiKey;
    if (data.apiVersion) apiVersion.value = data.apiVersion;
    if (data.deploymentName) deploymentName.value = data.deploymentName;
    if (data.useJsonMode !== undefined) useJsonMode.checked = data.useJsonMode;
    if (data.useJsonSchema !== undefined) useJsonSchema.checked = data.useJsonSchema;
    if (data.useTextMode !== undefined) useTextMode.checked = data.useTextMode;
    updateFormFields(); // Update field visibility based on loaded provider
  });

  // Endpoint validation
  endpoint.addEventListener('input', validateEndpoint);
  endpoint.addEventListener('blur', validateEndpoint);

  function validateEndpoint() {
    const value = endpoint.value.trim();
    const isValid = value === '' || value.startsWith('http://') || value.startsWith('https://');
    
    endpoint.classList.toggle('error', !isValid);
    endpointError.style.display = isValid ? 'none' : 'block';
    
    return isValid;
  }

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

      // Show/hide test button based on active tab
      const testButton = document.getElementById('testConnectionBtn');
      testButton.style.display = button.dataset.tab === 'ai-model' ? 'block' : 'none';
    });
  });

  // Initialize test button visibility based on default active tab
  const testButton = document.getElementById('testConnectionBtn');
  testButton.style.display = document.querySelector('.tab-button.active').dataset.tab === 'ai-model' ? 'block' : 'none';

  // Function to normalize endpoint URLs
  function normalizeEndpoint(url) {
    if (!url) return url;
    url = url.trim();
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  // Function to check if a node has a name attribute
  function getNodeName(node) {
    return node.name || node.fullName || node.displayName;
  }

  // Function to resolve UUIDs
  async function resolveUUIDs(reportId) {
    console.log('Starting UUID resolution...');
    
    // Get all edge collections from storage
    const data = await chrome.storage.local.get(null);
    const info = data.reportInfo;
    
    if (!info || !info.mainFilter) {
      throw new Error('No report info or main filter found');
    }

    // Get main filter edges
    const mainFilterKey = `edges_${reportId}.${info.mainFilter}`;
    const mainEdges = data[mainFilterKey] || [];
    
    // Find UUIDs that need resolution
    const uuidsToResolve = new Map(); // UUID -> edge object that needs the name
    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    
    // Recursive function to find factSheet objects
    function findFactSheets(obj) {
      if (!obj) return;
      
      // If this is a factSheet object with an ID
      if (obj.factSheet?.id) {
        const factSheet = obj.factSheet;
        // Only add to resolution if it has no name properties at this level
        if (!factSheet.name && !factSheet.fullName && !factSheet.displayName) {
          const id = factSheet.id;
          if (uuidPattern.test(id)) {
            uuidsToResolve.set(id, factSheet);
          }
        }
      }
      
      // Check arrays (like edges arrays)
      if (Array.isArray(obj)) {
        obj.forEach(item => findFactSheets(item));
        return;
      }
      
      // Check objects (including node objects and relationship objects)
      if (typeof obj === 'object') {
        Object.values(obj).forEach(value => findFactSheets(value));
      }
    }

    // Process all edges
    mainEdges.forEach(edge => findFactSheets(edge));

    const initialUUIDCount = uuidsToResolve.size;
    console.log(`Found ${initialUUIDCount} UUIDs to resolve:`, Array.from(uuidsToResolve.keys()));

    // If we have UUIDs to resolve, check more filters
    let resolvedCount = 0;
    const resolvedUUIDs = new Set(); // Track unique resolved UUIDs

    if (uuidsToResolve.size > 0) {
      // Look through more filters' edges for resolution
      for (const filterType of info.moreFilters) {
        const filterKey = `edges_${reportId}.${filterType}`;
        const filterEdges = data[filterKey] || [];
        
        filterEdges.forEach(edge => {
          if (edge.node?.id && uuidsToResolve.has(edge.node.id)) {
            const name = getNodeName(edge.node);
            if (name) {
              // Find all matching factSheets in the main edges and update them
              mainEdges.forEach(mainEdge => {
                const updateFactSheets = (obj) => {
                  if (obj?.factSheet?.id === edge.node.id) {
                    // Copy the name attribute that was found
                    if (edge.node.name) obj.factSheet.name = edge.node.name;
                    if (edge.node.fullName) obj.factSheet.fullName = edge.node.fullName;
                    if (edge.node.displayName) obj.factSheet.displayName = edge.node.displayName;
                    // Only increment count if we haven't resolved this UUID before
                    if (!resolvedUUIDs.has(edge.node.id)) {
                      resolvedUUIDs.add(edge.node.id);
                      resolvedCount++;
                    }
                  }
                  // Recursively check nested edges
                  if (obj?.edges) {
                    obj.edges.forEach(e => updateFactSheets(e.node));
                  }
                  // Check other nested objects that might contain edges
                  if (typeof obj === 'object') {
                    Object.values(obj).forEach(value => {
                      if (value && typeof value === 'object' && value.edges) {
                        value.edges.forEach(e => updateFactSheets(e.node));
                      }
                    });
                  }
                };
                
                // Start recursive check from the main edge
                updateFactSheets(mainEdge.node);
              });
              uuidsToResolve.delete(edge.node.id);
            }
          }
        });
        
        if (uuidsToResolve.size === 0) break;
      }
    }

    // Save the resolved edges to storage with _resolved suffix
    const resolvedKey = `${mainFilterKey}_resolved`;
    await chrome.storage.local.set({ [resolvedKey]: mainEdges });
    
    // Log the resolved edges
    console.log('Resolved edges:', mainEdges);
    
    return {
      edges: mainEdges,
      stats: {
        total: mainEdges.length,
        needsResolution: initialUUIDCount,
        resolved: resolvedCount,
        unresolved: uuidsToResolve.size
      }
    };
  }

  // Function to check if content script is ready
  async function isContentScriptReady(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return response && response.status === 'ok';
    } catch (error) {
      console.error('Content script not ready:', error);
      return false;
    }
  }

  /**
   * Transform and normalize the JSON structure from LeanIX GraphQL response.
   * 
   * This function performs several transformations on the input JSON:
   * 1. Transforms edges content to FactSheets:
   *    - Each edge's node content is transformed into a FactSheet entry
   *    - The transformed nodes are collected into a list of FactSheets
   * 
   * 2. Renames fields for better readability:
   *    - 'relToParent' becomes 'RelationToParent'
   *    - 'relToChild' becomes 'RelationToChild'
   *    - 'relXToY' patterns become 'RelationsToY' (e.g., relApplicationToBusinessCapability -> RelationsToBusinessCapability)
   * 
   * 3. Processes relations:
   *    - Removes 'id' fields from relation nodes
   *    - Transforms relation nodes into a standardized format
   *    - Collects relations into a Relations array
   * 
   * 4. Recursively processes nested structures:
   *    - Handles nested edges arrays
   *    - Processes nested relation objects
   *    - Maintains hierarchy while transforming
   * 
   * @param {Object|Array} data - The input data to transform. Can be an object or array.
   * @returns {Object} The transformed data structure with standardized naming and format.
   */
  function transformJsonStructure(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // If it's an array, transform each item
    if (Array.isArray(data)) {
      return data.map(item => {
        // If the item has a node property, transform it to FactSheet
        if (item?.node) {
          const transformedNode = transformJsonStructure(item.node);
          return { FactSheet: transformedNode };
        }
        return transformJsonStructure(item);
      });
    }

    const newData = {};
    for (const [key, value] of Object.entries(data)) {
      let newKey = key;
      let newValue = value;

      // Transform edges to FactSheets
      if (key === 'edges' && Array.isArray(value)) {
        const factsheets = value.map(edge => {
          if (edge?.node) {
            const transformedNode = transformJsonStructure(edge.node);
            return { FactSheet: transformedNode };
          }
          return edge;
        });
        return { FactSheets: factsheets };
      }

      // Process relations
      if (key.startsWith('rel') && value?.edges && Array.isArray(value.edges)) {
        const relations = value.edges.map(edge => {
          if (edge?.node) {
            const relation = { ...edge.node };
            if ('id' in relation) {
              delete relation.id;
            }
            return { RelationTo: relation };
          }
          return edge;
        });
        newValue = { Relations: relations };
      }

      // Handle relXToY patterns
      if (key.startsWith('rel')) {
        if (key === 'relToParent') {
          newKey = 'RelationToParent';
        } else if (key === 'relToChild') {
          newKey = 'RelationToChild';
        } else if (key.includes('To')) {
          const parts = key.split('To', 2);
          if (parts.length > 1) {
            newKey = 'RelationsTo' + parts[1];
          }
        }
      }

      // Recursively transform nested structures
      newData[newKey] = transformJsonStructure(newValue);
    }

    return newData;
  }

  analyzeBtn.addEventListener('click', async function() {
    console.log('Analyze button clicked');
    
    // Show loading state
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Resolving UUIDs...';
    results.style.display = 'block';
    loadingIndicator.style.display = 'block';
    resultsContent.innerHTML = '';

    try {
      console.log('Starting analysis with reportId:', currentReportId);
      if (!currentReportId) {
        throw new Error('No report ID found');
      }

      // Get report info from storage
      const { reportInfo } = await chrome.storage.local.get('reportInfo');
      if (!reportInfo) {
        throw new Error('No report info found');
      }

      // Actually resolve UUIDs
      console.log('Beginning UUID resolution...');
      const resolution = await resolveUUIDs(currentReportId);
      console.log(`UUID Resolution complete: ${resolution.stats.total} total edges, ${resolution.stats.needsResolution} needed resolution, ${resolution.stats.resolved} resolved, ${resolution.stats.unresolved} unresolved`);
      
      // Transform the resolved edges
      analyzeBtn.textContent = 'Transforming data...';
      const transformedData = transformJsonStructure(resolution.edges);
      console.log('Transformed data:', transformedData);
      
      // Get settings
      const settings = await chrome.storage.sync.get([
        'modelType',
        'endpoint',
        'apiKey',
        'apiVersion',
        'deploymentName',
        'useJsonMode',
        'useJsonSchema',
        'useTextMode'
      ]);
      const isOModel = /^o\d+/i.test(settings.deploymentName);
      
      // Read the user-provided prompt (if any)
      const userPromptText = userPromptInput.value.trim();

      // Fill the prompt template – note the extra "userPrompt" variable added!
      const promptVariables = {
        mainFilter: reportInfo.mainFilter,
        moreFilters: reportInfo.moreFilters.join(', '),
        reportView: reportInfo.view,
        leftProperty: reportInfo.properties.left || 'None',
        rightProperty: reportInfo.properties.right || 'None',
        reportInfo: reportInfo,  // The complete report info
        userPrompt: userPromptText // Additional instructions from the user (optional)
      };
      const prompt = fillPromptTemplate(promptVariables, settings);
      
      analyzeBtn.textContent = 'Analyzing with AI...';
      if (isOModel) {
        resultsContent.innerHTML = `
          <div class="fact-sheet">
            <p><strong>Note:</strong> Using an O-series model requires more time for detailed reasoning. Please be patient...</p>
          </div>
        `;
      }
      
      // Scroll to bottom of container
      const container = document.querySelector('.container');
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
      
      const analysis = await doAIAnalysis(prompt, transformedData);
      
      // Display results
      console.log('Displaying results...');
      displayResults(analysis);
    } catch (error) {
      console.error('Error during analysis:', error);
      console.error('Error stack:', error.stack);
      resultsContent.innerHTML = `
        <div class="fact-sheet">
          <p class="error"><strong>Error analyzing the report: </strong>${error.message}</p>
        </div>
      `;
    } finally {
      loadingIndicator.style.display = 'none';
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analyze Report';
    }
  });

  function displayResults(factSheets) {
    let html = '<h3>Relevant Fact Sheets</h3>';
    
    factSheets.forEach(sheet => {
      html += `
        <div class="fact-sheet">
          <h3>${sheet.name || sheet.id}</h3>
          <p><strong>Why relevant:</strong> ${sheet.reason}</p>
        </div>
      `;
    });

    resultsContent.innerHTML = html;

    // Send fact sheets to content script for marking in report
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'markFactSheets',
        factSheets: factSheets
      });
    });
  }

  // Do AI analysis 
  async function doAIAnalysis(systemPrompt, transformedData) {
    console.log('Starting AI analysis...');
    console.log('System prompt:', systemPrompt);
    
    // Get current settings
    const settings = await chrome.storage.sync.get([
      'modelType',
      'endpoint',
      'apiKey',
      'apiVersion',
      'deploymentName',
      'useJsonMode',
      'useJsonSchema',
      'useTextMode'
    ]);
    console.log('Using AI settings:', {
      modelType: settings.modelType,
      endpoint: settings.endpoint,
      apiVersion: settings.apiVersion,
      deploymentName: settings.deploymentName,
      useJsonMode: settings.useJsonMode,
      useJsonSchema: settings.useJsonSchema,
      useTextMode: settings.useTextMode
      // Not logging apiKey for security
    });

    if (!settings.modelType || !settings.apiKey || !settings.deploymentName) {
      console.error('Missing required settings:', {
        hasModelType: !!settings.modelType,
        hasApiKey: !!settings.apiKey,
        hasDeploymentName: !!settings.deploymentName
      });
      throw new Error('Please configure AI settings first');
    }

    // Prepare messages
    const isOModel = /^o\d+/i.test(settings.deploymentName);
    const messages = isOModel 
      ? [
          {
            role: 'user',
            content: `${systemPrompt}\n\nINPUT:\n${JSON.stringify(transformedData, null, 2)}`
          }
        ]
      : [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `INPUT:\n${JSON.stringify(transformedData, null, 2)}`
          }
        ];

    let response;
    
    try {
      switch (settings.modelType) {
        case 'openai':
          response = await callOpenAI(messages, settings, isOModel);
          break;
        case 'azure':
          response = await callAzureOpenAI(messages, settings, isOModel);
          break;
        case 'genai':
          response = await callGenAI(messages, settings, isOModel);
          break;
        default:
          throw new Error('Unsupported model type');
      }
      console.log('Raw AI response:', response);
    } catch (error) {
      console.error(`${settings.modelType} API call failed:`, error);
      throw error;
    }

    // Parse and validate response
    try {
      console.log('Parsing AI response...');
      const parsed = JSON.parse(response);

      // Handle both direct arrays and objects with arrays
      const result = Array.isArray(parsed) ? parsed : parsed.factSheets;
      
      if (!Array.isArray(result)) {
        console.error('Response does not contain a valid array:', result);
        throw new Error('Response is not in the expected format');
      }

      // Validate each item in the array
      result.forEach((item, index) => {
        if (!item.id || !item.reason) {
          console.error(`Invalid item at index ${index}:`, item);
          throw new Error('Invalid response format');
        }
      });

      console.log('Parsed response:', parsed);
      // Add names from transformed data
      console.log('Adding names from transformed data...');
      if (Array.isArray(transformedData)) {
        // Function to find name in FactSheet
        function findNameInFactSheet(factSheet) {
          // Prioritize fullName > name > displayName
          return factSheet.fullName || factSheet.name || factSheet.displayName;
        }

        // Function to find FactSheet by ID in transformed data
        function findFactSheetById(id) {
          for (const item of transformedData) {
            if (item.FactSheet && item.FactSheet.id === id) {
              return findNameInFactSheet(item.FactSheet);
            }
          }
          return null;
        }

        // Add names to each result item
        result.forEach(item => {
          const name = findFactSheetById(item.id);
          if (name) {
            item.name = name;
          } else {
            console.warn(`No name found for ID: ${item.id}`);
          }
        });
      }

      console.log('Final result with names:', result);
      return result;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Raw response that failed parsing:', response);
      throw new Error('Invalid response from AI service');
    }
  }

  async function callOpenAI(messages, settings, isOModel) {
    console.log('Calling OpenAI API...');
    const requestBody = {
      model: settings.deploymentName,
      messages: messages
    };

    if (!isOModel) {
      requestBody.temperature = 0;
    }

    if (settings.useJsonSchema) {
      const outputSchema = generateOutputSchema(settings.mainFilter);
      console.log('Generated output schema:', outputSchema);
      requestBody.response_format = {
        type: "json_schema",
        json_schema: outputSchema
      };
    } else if (settings.useJsonMode) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error('OpenAI request failed');
    }

    const data = await response.json();
    console.log('OpenAI response:', data);
    return data.choices[0].message.content;
  }

  async function callAzureOpenAI(messages, settings, isOModel) {
    console.log('Calling Azure OpenAI API...');
    if (!settings.endpoint || !settings.apiVersion) {
      console.error('Missing Azure settings:', {
        hasEndpoint: !!settings.endpoint,
        hasApiVersion: !!settings.apiVersion
      });
      throw new Error('Incomplete Azure OpenAI settings');
    }

    const requestBody = {
      messages: messages
    };

    if (!isOModel) {
      requestBody.temperature = 0;
    }

    if (settings.useJsonSchema) {
      const outputSchema = generateOutputSchema(settings.mainFilter);
      console.log('Generated output schema:', outputSchema);
      requestBody.response_format = {
        type: "json_schema",
        json_schema: outputSchema
      };
    } else if (settings.useJsonMode) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await fetch(
      `${settings.endpoint}/openai/deployments/${settings.deploymentName}/chat/completions?api-version=${settings.apiVersion}`,
      {
        method: 'POST',
        headers: {
          'api-key': settings.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure OpenAI request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });

      if (response.status === 429) {
        throw new Error('Token limit exceeded. Please request a quota increase for your Azure OpenAI deployment.');
      }

      throw new Error('Azure OpenAI request failed');
    }

    const data = await response.json();
    console.log('Azure OpenAI response:', data);
    return data.choices[0].message.content;
  }

  async function callGenAI(messages, settings, isOModel) {
    console.log('Calling GenAI API...');
    if (!settings.endpoint || !settings.apiVersion) {
      console.error('Missing GenAI settings:', {
        hasEndpoint: !!settings.endpoint,
        hasApiVersion: !!settings.apiVersion
      });
      throw new Error('Incomplete GenAI settings');
    }

    const requestBody = {
      deployment_id: settings.deploymentName,
      messages: messages
    };

    if (!isOModel) {
      requestBody.temperature = 0;
    }

    if (settings.useJsonSchema) {
      const outputSchema = generateOutputSchema(settings.mainFilter);
      console.log('Generated output schema:', outputSchema);
      requestBody.response_format = {
        type: "json_schema",
        json_schema: outputSchema
      };
    } else if (settings.useJsonMode) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await fetch(
      `${settings.endpoint}/api/v1/completions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GenAI request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error('GenAI request failed');
    }

    const data = await response.json();
    console.log('GenAI response:', data);
    return data.choices[0].message.content;
  }

  // Test connection functionality
  async function testConnection() {
    const footer = document.querySelector('.dialog-footer');
    const existingStatus = footer.querySelector('.connection-status');
    if (existingStatus) {
      existingStatus.remove();
    }

    // Disable buttons during test
    testConnectionBtn.disabled = true;
    saveSettingsBtn.disabled = true;

    const statusDiv = document.createElement('div');
    statusDiv.className = 'connection-status';
    footer.insertBefore(statusDiv, saveSettingsBtn);

    try {
      // Common validation
      if (!apiKey.value) {
        throw new Error('API Key is required');
      }

      switch (modelType.value) {
        case 'openai':
          await testOpenAIConnection();
          break;
        case 'azure':
          await testAzureConnection();
          break;
        case 'genai':
          await testGenAIConnection();
          break;
      }
      
      // Success state
      statusDiv.className = 'connection-status success';
      statusDiv.innerHTML = '<i class="sap-icon">&#xe05b;</i> Connection successful';
    } catch (error) {
      // Error state
      statusDiv.className = 'connection-status error';
      statusDiv.innerHTML = `<i class="sap-icon">&#xe1ec;</i> ${error.message}`;
    } finally {
      // Re-enable buttons
      testConnectionBtn.disabled = false;
      saveSettingsBtn.disabled = false;

      // Remove status after 3 seconds
      setTimeout(() => {
        statusDiv.remove();
      }, 3000);
    }
  }

  async function testOpenAIConnection() {
    if (!deploymentName.value) {
      throw new Error('Model Name is required');
    }

    // Test OpenAI connection and model existence
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.value}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Invalid API key or connection failed');
      }

      const models = await response.json();
      const modelExists = models.data.some(model => 
        model.id.toLowerCase() === deploymentName.value.toLowerCase()
      );

      if (!modelExists) {
        throw new Error(`Model "${deploymentName.value}" not found`);
      }
    } catch (error) {
      if (error.message.includes('Model')) {
        throw error;
      }
      throw new Error('Failed to connect to OpenAI');
    }
  }

  async function testAzureConnection() {
    if (!endpoint.value) {
      throw new Error('Endpoint is required');
    }
    if (!apiVersion.value) {
      throw new Error('API Version is required');
    }
    if (!deploymentName.value) {
      throw new Error('Deployment Name is required');
    }

    // Validate endpoint format
    if (!endpoint.value.startsWith('http://') && !endpoint.value.startsWith('https://')) {
      throw new Error('Endpoint must start with http:// or https://');
    }

    // Test Azure OpenAI connection with a simple completion request
    try {
      const normalizedEndpoint = normalizeEndpoint(endpoint.value);
      const testEndpoint = `${normalizedEndpoint}/openai/deployments/${deploymentName.value}/chat/completions?api-version=${apiVersion.value}`;
      const response = await fetch(testEndpoint, {
        method: 'POST',
        headers: {
          'api-key': apiKey.value,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: "Respond with 'OK' if you can read this message."
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure OpenAI test failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error('Failed to connect to Azure OpenAI');
      }

      const data = await response.json();
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from Azure OpenAI');
      }

    } catch (error) {
      console.error('Azure connection test error:', error);
      throw new Error('Failed to connect to Azure OpenAI. Please check your settings.');
    }
  }

  async function testGenAIConnection() {
    if (!endpoint.value) {
      throw new Error('Endpoint is required');
    }
    if (!apiVersion.value) {
      throw new Error('API Version is required');
    }
    if (!deploymentName.value) {
      throw new Error('Deployment Name is required');
    }

    // Validate endpoint format
    if (!endpoint.value.startsWith('http://') && !endpoint.value.startsWith('https://')) {
      throw new Error('Endpoint must start with http:// or https://');
    }

    // Test GenAI Hub connection
    try {
      const normalizedEndpoint = normalizeEndpoint(endpoint.value);
      const testEndpoint = `${normalizedEndpoint}/api/v1/health`;
      const response = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.value}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to connect to GenAI Hub');
      }
    } catch (error) {
      throw new Error('Failed to connect to GenAI Hub. Please check your settings.');
    }
  }

  testConnectionBtn.addEventListener('click', testConnection);
});
