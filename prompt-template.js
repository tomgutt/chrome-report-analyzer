/**
 * Prompt template for analyzing LeanIX report data.
 * Variables will be replaced with actual values using ${variableName} syntax.
 * Available variables:
 * - mainFilter: Primary filter type (e.g., "Application", "Interface")
 * - moreFilters: Additional filter types used for clustering
 * - reportView: View type of the report
 * - leftProperty: Left property setting
 * - rightProperty: Right property setting
 * - factSheets: Transformed fact sheet data (INPUT data)
 */

/**
 * Generates the JSON schema for the expected output format
 * @param {string} mainFilter - The type of fact sheet being analyzed
 * @returns {Object} The JSON schema object
 */
function generateOutputSchema(mainFilter) {
  return {
    name: "report_analysis",
    strict: true,
    schema: {
      type: "object",
      required: ["factSheets"],
      properties: {
        factSheets: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "reason"],
            properties: {
              id: {
                type: "string",
                description: `The id of the ${mainFilter}`
              },
              reason: {
                type: "string",
                description: "A short reason (1-2 sentences) why this is relevant to look at"
              }
            },
            additionalProperties: false
          }
        }
      },
      additionalProperties: false
    }
  };
}

// When JSON Output Schema is used
const promptTemplateJSONSchema = (variables) => `
INSTRUCTIONS:
    You are given a JSON as INPUT of a report in the context of Enterprise Architecture with LeanIX. 
    Your task is to analyze it and find the top most problematic or relevant \${mainFilter}s that a user should be looking at.
${variables.includeSettings ? `
    The report is configured to focus on specific fields that are important for the analysis, they are mentioned in the REPORT SETTINGS.
    Pay special attention to these fields and their values when determining which \${mainFilter}s are most relevant by using the FIELD DEFINITIONS AND VALUES${variables.userPrompt ? ' if the ADDITIONAL USER INSTRUCTIONS don\'t specify otherwise' : ''}.` : `
    Since no field definitions are provided, base your analysis ONLY on the displayName and description of each item.
    DO NOT try to interpret technical fields as their meaning is not defined.
    Analyze the data based on general best practices${variables.userPrompt ? ' and the ADDITIONAL USER INSTRUCTIONS' : ''}.`}
    ${variables.userPrompt ? 'Also consider the ADDITIONAL USER INSTRUCTIONS below when analyzing.' : ''}
    Don't change the name of any item on the INPUT.

${variables.includeSettings ? `REPORT SETTINGS:
    The report shows \${mainFilter}s clustered by the following filters: \${moreFilters}.
    The report focuses on \${reportView}, \${leftProperty} and \${rightProperty}.

FIELD DEFINITIONS AND VALUES:
    \${fieldTranslations}` : ''}

${variables.userPrompt ? `ADDITIONAL USER INSTRUCTIONS:
    \${userPrompt}` : ''}

OUTPUT:
    Sort the list so that the most problematic or relevant \${mainFilter} is at the top.
    Give me no more than \${maxResults} results.
`;

// When JSON Output Mode is used
const promptTemplateNoSchema = (variables) => `
INSTRUCTIONS:
    You are given a JSON as INPUT of a report in the context of Enterprise Architecture with LeanIX. 
    Your task is to analyze it and find the top most problematic or relevant \${mainFilter}s that a user should be looking at.
${variables.includeSettings ? `
    The report is configured to focus on specific fields that are important for the analysis, they are mentioned in the REPORT SETTINGS.
    Pay special attention to these fields and their values when determining which \${mainFilter}s are most relevant by using the FIELD DEFINITIONS AND VALUES${variables.userPrompt ? ' if the ADDITIONAL USER INSTRUCTIONS don\'t specify otherwise' : ''}.` : `
    Since no field definitions are provided, base your analysis ONLY on the displayName and description of each item.
    DO NOT try to interpret technical fields as their meaning is not defined.
    Analyze the data based on general best practices${variables.userPrompt ? ' and the ADDITIONAL USER INSTRUCTIONS' : ''}.`}
    ${variables.userPrompt ? 'Also consider the ADDITIONAL USER INSTRUCTIONS below when analyzing.' : ''}
    Don't change the name of any item on the INPUT.

${variables.includeSettings ? `REPORT SETTINGS:
    The report shows \${mainFilter}s clustered by the following filters: \${moreFilters}.
    The report focuses on \${reportView}, \${leftProperty} and \${rightProperty}.

FIELD DEFINITIONS AND VALUES:
    \${fieldTranslations}` : ''}

${variables.userPrompt ? `ADDITIONAL USER INSTRUCTIONS:
    \${userPrompt}` : ''}

OUTPUT:
    Give me a JSON with a list "factSheets". Each object should have the following properties:
    - id: The id of the \${mainFilter}
    - reason: A short reason (1-2 sentences) why you identified it as relevant to look at. 

    Don't list any other information from the INPUT.
    Sort the list so that the most problematic or relevant \${mainFilter} is at the top.
    Only respond with JSON and no additional text.
    Give me no more than \${maxResults} results.
`;

// When Text Mode is used
const promptTemplateTextMode = (variables) => `
INSTRUCTIONS:
    You are given a JSON as INPUT of a report in the context of Enterprise Architecture with LeanIX. 
    Your task is to analyze it and find the top most problematic or relevant \${mainFilter}s that a user should be looking at.
${variables.includeSettings ? `
    The report is configured to focus on specific fields that are important for the analysis, they are mentioned in the REPORT SETTINGS.
    Pay special attention to these fields and their values when determining which \${mainFilter}s are most relevant by using the FIELD DEFINITIONS AND VALUES${variables.userPrompt ? ' if the ADDITIONAL USER INSTRUCTIONS don\'t specify otherwise' : ''}.` : `
    Since no field definitions are provided, base your analysis ONLY on the displayName and description of each item.
    DO NOT try to interpret technical fields as their meaning is not defined.
    Analyze the data based on general best practices${variables.userPrompt ? ' and the ADDITIONAL USER INSTRUCTIONS' : ''}.`}
    ${variables.userPrompt ? 'Also consider the ADDITIONAL USER INSTRUCTIONS below when analyzing.' : ''}
    Don't change the name of any item on the INPUT.

${variables.includeSettings ? `REPORT SETTINGS:
    The report shows \${mainFilter}s clustered by the following filters: \${moreFilters}.
    The report focuses on \${reportView}, \${leftProperty} and \${rightProperty}.

FIELD DEFINITIONS AND VALUES:
    \${fieldTranslations}` : ''}

${variables.userPrompt ? `ADDITIONAL USER INSTRUCTIONS:
    \${userPrompt}` : ''}

OUTPUT:
    Do NOT wrap your answer in any code blocks or markdown fences (no triple backticks).
    Return ONLY valid JSON, with a top-level property "factSheets" that is an array.
    Each object in "factSheets" must contain:
        - id: The id of the \${mainFilter}
        - reason: A short reason (1-2 sentences) why you identified it as relevant to look at.
    Don't list any other information from the INPUT.
    Sort the list so that the most problematic or relevant \${mainFilter} is at the top.
    Only respond with JSON and no additional text.
    Give me no more than \${maxResults} results.
`;

/**
 * Formats field translations into a readable string for the prompt
 * @param {Object} fieldTranslations - The field translations object
 * @returns {string} Formatted string describing the fields and their values
 */
function formatFieldTranslations(fieldTranslations) {
  if (!fieldTranslations || Object.keys(fieldTranslations).length === 0) return '';

  let result = '';
  
  // Process each field
  Object.entries(fieldTranslations).forEach(([fieldKey, fieldData]) => {
    if (fieldData.fieldTranslation) {
      result += `Field "${fieldKey}":\n`;
      result += `    Label: ${fieldData.fieldTranslation.label}\n`;
      result += `    Description: ${fieldData.fieldTranslation.helpText}\n\n`;
    }

    if (fieldData.valueTranslations && Object.keys(fieldData.valueTranslations).length > 0) {
      result += `    Possible values:\n`;
      Object.entries(fieldData.valueTranslations).forEach(([key, value]) => {
        result += `        "${key}":\n`;
        result += `            Label: ${value.label}\n`;
        result += `            Description: ${value.helpText}\n`;
      });
      result += '\n';
    }
  });

  return result;
}

/**
 * Fills the prompt template with the provided variables.
 * @param {Object} variables - Object containing values for template variables
 * @param {Object} settings - Settings object containing mode flags
 * @returns {string} The filled prompt template
 */
function fillPromptTemplate(variables, settings) {
  let filledPrompt;
  if (settings.useJsonSchema) {
    filledPrompt = promptTemplateJSONSchema(variables);
  } else if (settings.useTextMode) {
    filledPrompt = promptTemplateTextMode(variables);
  } else {
    filledPrompt = promptTemplateNoSchema(variables);
  }
  
  // Format field translations if they exist
  if (variables.reportInfo?.fieldTranslations) {
    variables.fieldTranslations = formatFieldTranslations(variables.reportInfo.fieldTranslations);
  } else {
    variables.fieldTranslations = '';
  }
  
  // Replace each variable in the template
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = '${' + key + '}';
    // Handle arrays and objects by converting them to formatted strings
    const replacementValue = typeof value === 'object' 
      ? JSON.stringify(value, null, 2)
      : String(value);
    filledPrompt = filledPrompt.replace(new RegExp('\\${' + key + '}', 'g'), replacementValue);
  });
  
  return filledPrompt;
}

export { promptTemplateJSONSchema, promptTemplateNoSchema, promptTemplateTextMode, fillPromptTemplate, generateOutputSchema }; 