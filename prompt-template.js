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
const promptTemplateJSONSchema = `
INSTRUCTIONS:
    You are given a JSON as INPUT of a report in the context of Enterprise Architecture with LeanIX. 
    Your task is to analyze it and find the top most problematic or relevant \${mainFilter}s that should be looked at.
    Concentrate only on the REPORT SETTINGS. This is what the user wants to look at and concentrate on.
    Don't change the name of any item on the INPUT.

REPORT SETTINGS:
    The report shows \${mainFilter}s clustered by the following filters: \${moreFilters}.
    The report focuses on \${reportView}, \${leftProperty} and \${rightProperty}.

OUTPUT:
    Sort the list so that the most problematic or relevant \${mainFilter} is at the top.
    Give me no more than 20 results.
`;

// When JSON Output Mode is used
const promptTemplateNoSchema = `
INSTRUCTIONS:
    You are given a JSON as INPUT of a report in the context of Enterprise Architecture with LeanIX. 
    Your task is to analyze it and find the top most problematic or relevant \${mainFilter}s that should be looked at.
    Concentrate only on the REPORT SETTINGS. This is what the user wants to look at and concentrate on.
    Don't change the name of any item on the INPUT.

REPORT SETTINGS:
    The report shows \${mainFilter}s clustered by the following filters: \${moreFilters}.
    The report focuses on \${reportView}, \${leftProperty} and \${rightProperty}.

OUTPUT:
    Give me a JSON with a list "factSheets". Each object should have the following properties:
    - id: The id of the \${mainFilter}
    - reason: A short reason (1-2 sentences) why you identified it as relevant to look at. 

    Don't list any other information from the INPUT.
    Sort the list so that the most problematic or relevant \${mainFilter} is at the top.
`;

// When Text Mode is used
const promptTemplateTextMode = `
INSTRUCTIONS:
    You are given a JSON as INPUT of a report in the context of Enterprise Architecture with LeanIX. 
    Your task is to analyze it and find the top most problematic or relevant \${mainFilter}s that should be looked at.
    Concentrate only on the REPORT SETTINGS. This is what the user wants to look at and concentrate on.
    Don't change the name of any item on the INPUT.

REPORT SETTINGS:
    The report shows \${mainFilter}s clustered by the following filters: \${moreFilters}.
    The report focuses on \${reportView}, \${leftProperty} and \${rightProperty}.

OUTPUT:
    Do NOT wrap your answer in any code blocks or markdown fences (no triple backticks).
    Return ONLY valid JSON, with a top-level property "factSheets" that is an array.
    Each object in "factSheets" must contain:
        - id: The id of the \${mainFilter}
        - reason: A short reason (1-2 sentences) why you identified it as relevant to look at.
    Don't list any other information from the INPUT.
    Sort the list so that the most problematic or relevant \${mainFilter} is at the top.
    Only respond with JSON and no additional text.
    Give me no more than 20 results.
`;

/**
 * Fills the prompt template with the provided variables.
 * @param {Object} variables - Object containing values for template variables
 * @param {Object} settings - Settings object containing mode flags
 * @returns {string} The filled prompt template
 */
function fillPromptTemplate(variables, settings) {
  let filledPrompt;
  if (settings.useJsonSchema) {
    filledPrompt = promptTemplateJSONSchema;
  } else if (settings.useTextMode) {
    filledPrompt = promptTemplateTextMode;
  } else {
    filledPrompt = promptTemplateNoSchema;
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