/**
 * Spanish Companies Service
 *
 * Simplified service focused exclusively on Spanish companies data
 * from remote BORME server with text and vector search capabilities
 */

class SpanishCompaniesService {
  constructor() {
    // Use api-proxy worker for CORS handling
    this.baseUrl = 'https://api.ncdata.eu';
    this.apiKey = null; // Auth is handled by the api-proxy Cloudflare Worker
    this.name = 'spanish-companies';
    this.version = '1.1.0'; // Production-grade improvements

    // Retry configuration
    this.maxRetries = 3;
    this.baseRetryDelay = 1000; // 1 second
    this.maxRetryDelay = 10000; // 10 seconds
  }

  /**
   * Configure the service with custom settings
   * @param {Object} config - Configuration options
   * @param {string} config.baseUrl - API base URL
   * @param {string} config.apiKey - API key for authentication
   */
  configure(config) {
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    if (config.apiKey) this.apiKey = config.apiKey;
  }

  /**
   * Fetch with retry logic and exponential backoff
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<Response>}
   */
  async fetchWithRetry(url, options = {}, retryCount = 0) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
        },
      });

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (
        !response.ok &&
        response.status !== 429 &&
        response.status >= 400 &&
        response.status < 500
      ) {
        return response;
      }

      // Retry on server errors or rate limits
      if (!response.ok && retryCount < this.maxRetries) {
        const delay = Math.min(this.baseRetryDelay * Math.pow(2, retryCount), this.maxRetryDelay);
        console.warn(
          `SpanishCompaniesService: Request failed with ${response.status}, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }

      return response;
    } catch (error) {
      // Network errors - retry with backoff
      if (retryCount < this.maxRetries) {
        const delay = Math.min(this.baseRetryDelay * Math.pow(2, retryCount), this.maxRetryDelay);
        console.warn(
          `SpanishCompaniesService: Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries}):`,
          error.message
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Categorize and format API errors for better handling
   * @param {Error} error - The error object
   * @param {string} context - Context of the operation
   * @returns {Object} Categorized error
   */
  categorizeError(error, context) {
    const errorInfo = {
      context,
      message: error.message,
      timestamp: new Date().toISOString(),
    };

    if (error.message.includes('fetch') || error.message.includes('network')) {
      return { ...errorInfo, type: 'NETWORK_ERROR', recoverable: true };
    }
    if (error.message.includes('401') || error.message.includes('403')) {
      return { ...errorInfo, type: 'AUTH_ERROR', recoverable: false };
    }
    if (error.message.includes('404')) {
      return { ...errorInfo, type: 'NOT_FOUND', recoverable: false };
    }
    if (error.message.includes('429')) {
      return { ...errorInfo, type: 'RATE_LIMIT', recoverable: true };
    }
    if (
      error.message.includes('500') ||
      error.message.includes('502') ||
      error.message.includes('503')
    ) {
      return { ...errorInfo, type: 'SERVER_ERROR', recoverable: true };
    }
    return { ...errorInfo, type: 'UNKNOWN_ERROR', recoverable: false };
  }

  /**
   * Safely extract answer from API response, handling [object Object] issues
   */
  safeExtractAnswer(apiResponse) {
    let answer = apiResponse.data?.answer?.content || '';

    // Ensure answer is a string
    if (typeof answer !== 'string') {
      console.warn(
        'SpanishCompaniesService: Answer is not a string, attempting to stringify:',
        typeof answer
      );
      try {
        answer = JSON.stringify(answer);
      } catch (err) {
        console.error('SpanishCompaniesService: Failed to stringify answer:', err);
        answer = '';
      }
    }

    // Detect and clear [object Object] serialization errors
    if (answer.includes('[object Object]')) {
      console.error(
        'SpanishCompaniesService: Detected [object Object] in answer from API. Clearing invalid answer.'
      );
      return ''; // Return empty to force fallback logic
    }

    return answer;
  }

  /**
   * Autocomplete company names for quick suggestions using dedicated endpoint
   * Uses the /bormes/companies/directory/autocomplete endpoint which queries the
   * complete borme_companies index (contains all indexed companies)
   */
  async autocompleteCompanies(query, options = {}) {
    const { limit = 8 } = options;

    if (!query || query.length < 2) {
      return { suggestions: [] };
    }

    try {
      // Normalize query: trim whitespace only (backend handles case normalization)
      const normalizedQuery = query.trim();
      console.log(`Spanish Companies: Autocompleting "${normalizedQuery}"`);

      // Use the directory autocomplete endpoint which queries borme_companies index
      // This has the complete company index vs borme_v2 which may miss some companies
      const response = await fetch(
        `${this.baseUrl}/bormes/companies/directory/autocomplete?q=${encodeURIComponent(normalizedQuery)}&limit=${limit}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Autocomplete API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Transform suggestions to the format expected by the UI
      // Directory autocomplete returns: { id, company_name, last_updated, is_alias?, original_name?, has_new_name?, new_company_name? }
      const suggestions = (result.suggestions || []).map(suggestion => {
        // Build label based on alias status
        let label = suggestion.company_name;
        if (suggestion.is_alias) {
          // This is a NEW name, show previous name
          label = `${suggestion.company_name} (antes: ${suggestion.original_name})`;
        } else if (suggestion.has_new_name) {
          // This is an OLD name that has been renamed
          label = `${suggestion.company_name} (ahora: ${suggestion.new_company_name})`;
        }

        return {
          name: suggestion.company_name, // UI expects 'name' field
          label: label,
          value: suggestion.original_name || suggestion.company_name, // Use original name for search
          id: suggestion.id, // Include the company ID for exact lookups
          identifier: suggestion.id,
          last_updated: suggestion.last_updated,
          score: suggestion.score || 0,
          type: 'company',
          // Include alias information for UI display
          is_alias: suggestion.is_alias || false,
          original_name: suggestion.original_name || null,
          display_name: suggestion.company_name, // The name to display (new name for aliases)
          change_date: suggestion.change_date || null,
          // Reverse lookup: old name has a new name
          has_new_name: suggestion.has_new_name || false,
          new_company_name: suggestion.new_company_name || null,
        };
      });

      // Deduplicate by normalized name, but PREFER entries with alias info
      const seenNames = new Map(); // Map of normalizedName -> suggestion
      const deduplicatedSuggestions = [];

      for (const suggestion of suggestions) {
        const normalizedName = (suggestion.name || '').toUpperCase().trim();
        const existing = seenNames.get(normalizedName);

        if (!existing) {
          // First time seeing this name
          seenNames.set(normalizedName, suggestion);
          deduplicatedSuggestions.push(suggestion);
        } else if (suggestion.is_alias && !existing.is_alias) {
          // New entry has alias info, existing doesn't - replace
          const existingIndex = deduplicatedSuggestions.indexOf(existing);
          if (existingIndex >= 0) {
            deduplicatedSuggestions[existingIndex] = suggestion;
            seenNames.set(normalizedName, suggestion);
          }
        } else if (suggestion.has_new_name && !existing.has_new_name && !existing.is_alias) {
          // New entry has new_name info, existing doesn't - replace
          const existingIndex = deduplicatedSuggestions.indexOf(existing);
          if (existingIndex >= 0) {
            deduplicatedSuggestions[existingIndex] = suggestion;
            seenNames.set(normalizedName, suggestion);
          }
        }
        // Otherwise keep existing (first one wins for same priority)
      }

      console.log('Autocomplete suggestions:', deduplicatedSuggestions);

      return {
        suggestions: deduplicatedSuggestions,
        query: normalizedQuery,
        total: suggestions.length,
        success: result.success,
      };
    } catch (error) {
      console.error('Autocomplete failed:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Autocomplete officer names for quick suggestions using dedicated endpoint
   * Uses the fast /bormes/officers-autocomplete endpoint with nested queries
   */
  async autocompleteOfficers(query, options = {}) {
    const { limit = 8 } = options;

    if (!query || query.length < 2) {
      return { suggestions: [] };
    }

    try {
      // Normalize query: trim whitespace only (backend handles case normalization)
      const normalizedQuery = query.trim();
      console.log(`Spanish Officers: Autocompleting "${normalizedQuery}"`);

      // Use the proper autocomplete endpoint (10-100x faster than /bormes/officers)
      const response = await fetch(`${this.baseUrl}/bormes/officers-autocomplete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: normalizedQuery,
          limit: limit,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Officers autocomplete API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      // Transform suggestions to the format expected by the UI
      const suggestions = (result.suggestions || []).map(suggestion => ({
        name: suggestion.name, // UI expects 'name' field
        label: suggestion.label || suggestion.name,
        value: suggestion.name,
        type: 'officer',
        company_count: suggestion.company_count || 0,
      }));

      console.log('Officer suggestions:', suggestions);

      return {
        suggestions: suggestions,
        query: normalizedQuery,
        total: suggestions.length,
        success: result.success,
      };
    } catch (error) {
      console.error('Officers autocomplete failed:', error);
      return { suggestions: [] };
    }
  }

  /**
   * Expand a company node using PostgreSQL — returns clean canonical officer list.
   */
  async pgExpandCompany(companyName, options = {}) {
    const { size = 100 } = options;
    const params = new URLSearchParams({ name: companyName, size: size.toString() });
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/bormes/pg/expand-company?${params}`,
      { method: 'GET' }
    );
    if (!response.ok) throw new Error(`pgExpandCompany ${response.status}`);
    return response.json();
  }

  /**
   * Expand an officer node using PostgreSQL — returns clean canonical company list.
   */
  async pgExpandOfficer(officerName, options = {}) {
    const { size = 100 } = options;
    const params = new URLSearchParams({ name: officerName, size: size.toString() });
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/bormes/pg/expand-officer?${params}`,
      { method: 'GET' }
    );
    if (!response.ok) throw new Error(`pgExpandOfficer ${response.status}`);
    return response.json();
  }

  /**
   * Direct search using /bormes/working-search endpoint (GET)
   * More efficient for simple company lookups - no LLM processing
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async workingSearch(query, options = {}) {
    const {
      size = 50,
      offset = 0,
      exactMatch = false,
      officerMode = false,
      semantic = false,
    } = options;

    try {
      const params = new URLSearchParams({
        query: query,
        size: size.toString(),
        offset: offset.toString(),
        exact_match: exactMatch.toString(),
        officer_mode: officerMode.toString(),
        semantic: semantic.toString(),
      });

      console.log(
        `Spanish Companies (working-search): "${query}" [size=${size}, exact=${exactMatch}]`
      );

      const response = await this.fetchWithRetry(
        `${this.baseUrl}/bormes/working-search?${params}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Working search API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      return {
        success: true,
        results: result.results || [],
        officers: result.officers || [],
        total: result.total || result.total_hits || result.results?.length || 0,
        hasMore: result.has_more || false,
        query: query,
        source: 'working-search',
        searchEnhancements: result.search_enhancements || {},
      };
    } catch (error) {
      console.warn('Working search failed, will fall back to agent-intelligence:', error.message);
      throw error;
    }
  }

  /**
   * Search Spanish companies with intelligent endpoint selection
   * Tries working-search first (faster), falls back to agent-intelligence
   */
  async searchCompanies(query, options = {}) {
    const {
      limit = 50,
      includeOfficers: _includeOfficers = false,
      includeDetails: _includeDetails = true,
      stream = false,
      onStreamChunk = null,
      forceAgentIntelligence = false,
    } = options;

    try {
      console.log(`Spanish Companies: Searching for "${query}"`);

      // Detect if this is a simple company name search (no question words or complex queries)
      const isSimpleCompanySearch = this.isSimpleCompanyName(query);

      // For simple company name searches, try working-search first (faster, no LLM needed)
      if (isSimpleCompanySearch && !forceAgentIntelligence) {
        try {
          const workingResult = await this.workingSearch(query, {
            size: limit,
            exactMatch: false,
            semantic: true,
          });

          if (workingResult.success && workingResult.results.length > 0) {
            console.log(
              `Using working-search results: ${workingResult.results.length} companies found`
            );
            return this.formatDirectSearchResults(workingResult, query);
          }
        } catch {
          console.log('Working search unavailable, falling back to agent-intelligence');
        }
      }

      // Use agent intelligence for complex queries or as fallback
      console.log(`Using agent intelligence for query: "${query}"`);
      const response = await this.fetchWithRetry(`${this.baseUrl}/bormes/agent-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Spanish companies API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Spanish companies raw response:', result);

      // If streaming is requested and we have an answer, simulate streaming
      if (stream && onStreamChunk && result.data?.answer?.content) {
        await this.simulateStreaming(result.data.answer.content, onStreamChunk);
      }
      return this.formatSearchResults(result, query);
    } catch (error) {
      console.error('Spanish companies search failed:', error);
      const categorizedError = this.categorizeError(error, 'searchCompanies');
      throw new Error(
        `Spanish companies search failed: ${error.message} [${categorizedError.type}]`
      );
    }
  }

  /**
   * Simulate streaming by chunking the response text
   */
  async simulateStreaming(content, onStreamChunk, chunkSize = 3) {
    const words = content.split(' ');
    let currentChunk = '';

    for (let i = 0; i < words.length; i++) {
      currentChunk += words[i] + ' ';

      // Send chunk every few words
      if ((i + 1) % chunkSize === 0 || i === words.length - 1) {
        if (onStreamChunk) {
          onStreamChunk(currentChunk.trim() + ' ');
        }
        currentChunk = '';

        // Add small delay to simulate real streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  /**
   * Smart search using Text-to-DSL with Search Templates
   * More efficient than RAG - LLM generates query, Elasticsearch returns precise results
   */
  async smartSearch(query, options = {}) {
    const {
      stream = false,
      onStreamChunk = null,
      exactCompanyName = null, // Pass exact company name to bypass LLM extraction
    } = options;

    try {
      console.log(`Spanish Companies (Smart Search): Querying "${query}"`);
      if (exactCompanyName) {
        console.log(`Using exact company name: "${exactCompanyName}"`);
      }

      const requestBody = {
        query: query,
      };

      // Add exact company name if provided (for precise autocomplete-based searches)
      if (exactCompanyName) {
        requestBody.company_name = exactCompanyName;
      }

      const response = await fetch(`${this.baseUrl}/bormes/smart-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Smart search API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();
      console.log('Smart search raw response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Smart search failed');
      }

      // Format the response for the UI
      // Note: Backend already filters officers by role using terms.json
      const officers = result.results?.all_officers || result.results?.officers || [];
      const company_data = result.results?.company_data || [];
      const mostRecentOfficer = officers[0];

      // Generate a natural language answer based on the template used
      let answer = '';
      if (result.template_used === 'recent_appointments' && mostRecentOfficer) {
        answer = `El oficial más recientemente nombrado en ${result.params.company_name} es **${mostRecentOfficer.name}** en **${mostRecentOfficer.company}** con fecha de publicación BORME: **${mostRecentOfficer.date}**.\n\n`;

        if (officers.length > 1) {
          answer += `Se encontraron ${officers.length} registros de oficiales en total. Los 5 nombramientos más recientes son:\n\n`;
          officers.slice(0, 5).forEach((officer, idx) => {
            answer += `${idx + 1}. **${officer.name}** en **${officer.company}** - ${officer.role || officer.type || 'Cargo desconocido'} (${officer.date})\n`;
          });
        }
      } else if (officers.length === 1) {
        // Single officer result - likely a specific role query
        answer = `**${mostRecentOfficer.name}** - ${mostRecentOfficer.type || mostRecentOfficer.role || 'Cargo desconocido'}\n\n`;
        answer += `**Empresa:** ${mostRecentOfficer.company}\n`;
        answer += `**Fecha BORME:** ${mostRecentOfficer.date}\n`;
      } else if (officers.length > 0) {
        // Multiple officers
        answer = `Se encontraron ${officers.length} oficiales para la consulta.\n\n`;
        officers.slice(0, 10).forEach((officer, idx) => {
          answer += `${idx + 1}. **${officer.name}** - ${officer.role || officer.type || 'Cargo desconocido'} en ${officer.company} (${officer.date})\n`;
        });
      } else if (company_data.length > 0) {
        // No officers, but we have company data with parsed_details!
        const company = company_data[0];
        answer = `Información disponible para **${company.company_name}**:\n\n`;

        if (company.parsed_details) {
          const pd = company.parsed_details;
          if (pd.constitución) answer += `**Constitución:** ${pd.constitución}\n`;
          if (pd.capital) answer += `**Capital:** ${pd.capital}\n`;
          if (pd.domicilio) answer += `**Domicilio:** ${pd.domicilio}\n`;
          if (pd.objeto_social)
            answer += `**Objeto social:** ${pd.objeto_social.substring(0, 200)}...\n`;
          if (pd.datos_registrales) answer += `**Datos registrales:** ${pd.datos_registrales}\n`;
        }

        if (company.officers && company.officers.length > 0) {
          answer += `\n**Administradores:**\n`;
          company.officers.forEach(officer => {
            answer += `- ${officer.name}`;
            if (officer.specific_role) answer += ` (${officer.specific_role})`;
            answer += `\n`;
          });
        }

        answer += `\n*Fecha de publicación BORME:* ${company.indexed_date}\n`;
      } else {
        // No officers and no company data found
        answer = `No se encontraron datos para la consulta en ${result.params.company_name}.\n\n`;
        answer += `Esto puede deberse a que:\n`;
        answer += `- La empresa no tiene registros en el período consultado\n`;
        answer += `- El nombre de la empresa puede ser incorrecto\n`;
        answer += `- Los datos aún no han sido indexados\n`;
      }

      answer += `\n\n*Plantilla utilizada: ${result.template_used}*\n`;
      answer += `*Confianza: ${(result.confidence * 100).toFixed(0)}%*\n`;
      answer += `*Razonamiento: ${result.reasoning}*\n`;
      answer += `\n**Método:** Text-to-DSL con Search Templates (más eficiente que RAG)`;

      // If streaming is requested, simulate streaming
      if (stream && onStreamChunk) {
        await this.simulateStreaming(answer, onStreamChunk);
      }

      return {
        success: true,
        answer: answer,
        rawData: {
          officers: officers,
          company_data: company_data, // Include company_data with parsed_details!
          template: result.template_used,
          params: result.params,
          confidence: result.confidence,
          reasoning: result.reasoning,
          total: result.results.total,
        },
        results: {
          company_data: company_data, // Also add to results for easier access
        },
        source: 'smart-search',
      };
    } catch (error) {
      console.error('Smart search failed:', error);
      throw new Error(`Smart search failed: ${error.message}`);
    }
  }

  /**
   * Search for company officers/directors with enhanced temporal analysis instructions
   */
  async searchOfficers(companyName, options = {}) {
    const {
      position = '',
      activeOnly: _activeOnly = false,
      stream = false,
      onStreamChunk = null,
    } = options;

    try {
      console.log(`Spanish Companies: Searching officers for "${companyName}"`);

      let query;
      if (position) {
        query = `${position} de ${companyName}`;
      } else {
        // Enhanced query with temporal analysis instructions for the LLM
        query = `Quiénes son los administradores ACTUALES de ${companyName}? 

INSTRUCCIONES IMPORTANTES para el análisis temporal:
1. Analizar cronológicamente todas las fechas de nombramientos, reelecciones, ceses y revocaciones
2. Para cada administrador-cargo, ordenar eventos por fecha (más antiguos primero)
3. CRÍTICO - Normalizar nombres para detectar variaciones:
   - "GOSLIN COX BRUCE RIDGWAY" y "GOSLIN BRUCE RIDGWAY" son la MISMA persona
   - Considerar variaciones de nombre al agrupar eventos temporales
4. Determinar el estado actual siguiendo esta lógica:
   - Si el último evento para una persona-cargo es nombramiento/reelección = ACTIVO
   - Si el último evento para una persona-cargo es cese/revocación = INACTIVO
5. Incluir solo administradores ACTUALES (último evento = nombramiento/reelección)
6. Especificar claramente quiénes son actuales vs. pasados
7. Mostrar fechas de los nombramientos más recientes de los actuales

⚠️ IMPORTANTE: Añadir siempre esta advertencia al final:
"ADVERTENCIA: Los registros BORME pueden contener variaciones en los nombres de las mismas personas. Para verificación oficial, consulte directamente el Registro Mercantil."

Por favor, determina quiénes ejercen actualmente sus cargos basándote en el análisis cronológico de eventos.`;
      }

      const response = await fetch(`${this.baseUrl}/bormes/agent-intelligence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          query: query,
        }),
      });

      if (!response.ok) {
        throw new Error(`Officers search API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Officers search raw response:', result);

      // If streaming is requested and we have an answer, simulate streaming
      if (stream && onStreamChunk && result.data?.answer?.content) {
        await this.simulateStreaming(result.data.answer.content, onStreamChunk);
      }

      return this.formatOfficersResults(result, companyName);
    } catch (error) {
      console.error('Officers search failed:', error);
      throw new Error(`Officers search failed: ${error.message}`);
    }
  }

  /**
   * Search for a specific person across companies
   */
  async searchPerson(personName, options = {}) {
    const {
      includeCompanies: _includeCompanies = true,
      includePositions: _includePositions = true,
    } = options;

    try {
      console.log(`Spanish Companies: Searching person "${personName}"`);

      const response = await fetch(`${this.baseUrl}/bormes/agent-intelligence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          query: personName,
        }),
      });

      if (!response.ok) {
        throw new Error(`Person search API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Person search raw response:', result);

      return this.formatPersonResults(result, personName);
    } catch (error) {
      console.error('Person search failed:', error);
      throw new Error(`Person search failed: ${error.message}`);
    }
  }

  /**
   * Analyze relationships between companies
   */
  async analyzeRelationships(company1, company2, options = {}) {
    const {
      includeOfficers: _includeOfficers = true,
      includeShareholders: _includeShareholders = false,
    } = options;

    try {
      console.log(
        `Spanish Companies: Analyzing relationships between "${company1}" and "${company2}"`
      );

      const query = `¿Qué relación hay entre ${company1} y ${company2}?`;

      const response = await fetch(`${this.baseUrl}/bormes/agent-intelligence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          query: query,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Relationship analysis API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log('Relationship analysis raw response:', result);

      return this.formatRelationshipResults(result, company1, company2);
    } catch (error) {
      console.error('Relationship analysis failed:', error);
      throw new Error(`Relationship analysis failed: ${error.message}`);
    }
  }

  /**
   * Format search results from the API response
   */
  formatSearchResults(apiResponse, originalQuery) {
    const companies = [];
    const metadata = {
      query: originalQuery,
      queryType: apiResponse.data?.rawData?.queryType || 'general',
      timestamp: new Date().toISOString(),
      source: 'spanish_borme_database',
    };

    // Extract company information from the response
    if (apiResponse.data?.rawData?.officers && Array.isArray(apiResponse.data.rawData.officers)) {
      // If we have officers data, extract unique companies
      const companiesMap = new Map();

      apiResponse.data.rawData.officers.forEach(officer => {
        if (officer.company_name && !companiesMap.has(officer.company_name)) {
          companiesMap.set(officer.company_name, {
            name: officer.company_name,
            type: 'spanish_company',
            officers: [],
            source: 'borme',
          });
        }

        if (officer.company_name && companiesMap.has(officer.company_name)) {
          companiesMap.get(officer.company_name).officers.push({
            name: officer.name,
            position: officer.position,
            status: officer.status || 'unknown',
            appointmentDate: officer.appointment_date,
            removalDate: officer.removal_date,
          });
        }
      });

      companies.push(...Array.from(companiesMap.values()));
    }

    // If no companies found but we have a response, create a general result
    if (companies.length === 0 && apiResponse.data?.answer?.content) {
      companies.push({
        name: 'Search Results',
        type: 'search_result',
        content: apiResponse.data.answer.content,
        source: 'borme',
      });
    }

    return {
      success: true,
      companies,
      total: companies.length,
      metadata,
      answer: this.safeExtractAnswer(apiResponse),
      rawResponse: apiResponse,
    };
  }

  /**
   * Normalize Spanish names for better matching (handles BORME name variations)
   * Production-grade: Uses generic algorithms instead of hardcoded names
   */
  normalizeSpanishName(name) {
    if (!name) return '';

    return (
      name
        .toUpperCase()
        .trim()
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Remove common Spanish prefixes/titles
        .replace(/^(DON|DOÑA|D\.|DÑA\.)\s+/gi, '')
        // Remove common suffixes
        .replace(/\s+(JR\.?|SR\.?|III?|IV)$/gi, '')
        // Normalize accented characters for comparison
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .trim()
    );
  }

  /**
   * Extract significant name parts (first name + last names)
   * Handles Spanish naming conventions: FirstName LastName1 LastName2
   */
  extractNameParts(name) {
    const normalized = this.normalizeSpanishName(name);
    const parts = normalized.split(' ').filter(w => w.length > 1);

    // Spanish names typically: FIRSTNAME LASTNAME1 LASTNAME2
    // Sometimes with middle names or compound first names
    if (parts.length <= 3) {
      return parts; // Simple name, keep all parts
    }

    // For longer names, extract key parts:
    // - First part (first name)
    // - Last two parts (typically the two surnames in Spanish)
    const firstName = parts[0];
    const lastNames = parts.slice(-2);

    return [firstName, ...lastNames];
  }

  /**
   * Check if two Spanish names likely refer to the same person
   * Uses Jaccard similarity with significant name parts
   */
  areNamesSimilar(name1, name2, threshold = 0.5) {
    if (!name1 || !name2) return false;

    const normalized1 = this.normalizeSpanishName(name1);
    const normalized2 = this.normalizeSpanishName(name2);

    // Exact match after normalization
    if (normalized1 === normalized2) return true;

    // Extract significant parts
    const parts1 = this.extractNameParts(name1);
    const parts2 = this.extractNameParts(name2);

    // If either has fewer than 2 parts, require exact match
    if (parts1.length < 2 || parts2.length < 2) {
      return normalized1 === normalized2;
    }

    // Calculate Jaccard similarity on significant parts
    const set1 = new Set(parts1);
    const set2 = new Set(parts2);
    const intersection = [...set1].filter(x => set2.has(x));
    const union = new Set([...set1, ...set2]);

    const similarity = intersection.length / union.size;

    // Also check if last names match (stronger signal in Spanish naming)
    const lastName1Match =
      parts1.length >= 2 &&
      parts2.length >= 2 &&
      parts1[parts1.length - 1] === parts2[parts2.length - 1];
    const lastName2Match =
      parts1.length >= 3 &&
      parts2.length >= 3 &&
      parts1[parts1.length - 2] === parts2[parts2.length - 2];

    // If both last names match, consider it a match even with lower similarity
    if (lastName1Match && lastName2Match) return true;

    // Standard threshold check
    return similarity >= threshold || intersection.length >= 2;
  }

  /**
   * Group officers by likely same person (handles name variations)
   * @param {Array} officers - Array of officer records
   * @returns {Map} Groups of officers that are likely the same person
   */
  groupOfficersByPerson(officers) {
    const groups = new Map();
    const assigned = new Set();

    officers.forEach((officer, idx) => {
      if (assigned.has(idx)) return;

      const group = [officer];
      assigned.add(idx);

      // Find all similar names
      officers.forEach((other, otherIdx) => {
        if (assigned.has(otherIdx)) return;
        if (this.areNamesSimilar(officer.name, other.name)) {
          group.push(other);
          assigned.add(otherIdx);
        }
      });

      // Use the most common name variant as the canonical name
      const nameFreq = new Map();
      group.forEach(o => {
        const name = o.name?.toUpperCase().trim();
        nameFreq.set(name, (nameFreq.get(name) || 0) + 1);
      });

      let canonicalName = officer.name;
      let maxFreq = 0;
      nameFreq.forEach((freq, name) => {
        if (freq > maxFreq) {
          maxFreq = freq;
          canonicalName = name;
        }
      });

      groups.set(canonicalName, group);
    });

    return groups;
  }

  /**
   * Calculate current officer state based on appointment/cessation chronology
   * Enhanced with name normalization for BORME variations
   */
  calculateCurrentOfficerState(rawOfficers) {
    const officerTimeline = new Map();
    const currentState = new Map();
    const timeline = [];

    // Group officers by categories and collect events with dates
    // Use the 'status' field from the API or infer from other data
    const officersByCategory = {
      nombramientos: rawOfficers.filter(
        o =>
          o.event_type === 'nombramientos' ||
          o.status === 'active' ||
          (o.status !== 'ceased' && !o.removal_date)
      ),
      reelecciones: rawOfficers.filter(
        o => o.event_type === 'reelecciones' || o.position?.toLowerCase().includes('reelecc')
      ),
      ceses_dimisiones: rawOfficers.filter(
        o =>
          o.event_type === 'ceses_dimisiones' ||
          o.status === 'ceased' ||
          o.removal_date ||
          o.position?.toLowerCase().includes('ces') ||
          o.position?.toLowerCase().includes('dimis')
      ),
      revocaciones: rawOfficers.filter(
        o => o.event_type === 'revocaciones' || o.position?.toLowerCase().includes('revoc')
      ),
    };

    // Process each category and collect timeline events
    Object.entries(officersByCategory).forEach(([category, officers]) => {
      officers.forEach(officer => {
        const eventDate =
          officer.date || officer.appointment_date || officer.event_date || '1900-01-01';
        const isAppointment = category === 'nombramientos' || category === 'reelecciones';
        const isCessation = category === 'ceses_dimisiones' || category === 'revocaciones';

        const event = {
          name: officer.name,
          normalizedName: this.normalizeSpanishName(officer.name),
          position: officer.position,
          date: eventDate,
          type: category,
          isAppointment,
          isCessation,
          rawData: officer,
        };

        timeline.push(event);

        // ENHANCED: Group by normalized name + position to handle name variations
        const key = `${event.normalizedName}_${officer.position}`;
        if (!officerTimeline.has(key)) {
          officerTimeline.set(key, []);
        }
        officerTimeline.get(key).push(event);
      });
    });

    // Sort global timeline by date
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate current state for each officer-position combination
    officerTimeline.forEach((events, key) => {
      // Sort events chronologically for this specific officer-position
      events.sort((a, b) => new Date(a.date) - new Date(b.date));

      console.log(`=== SpanishCompaniesService: Analyzing ${key} ===`);
      console.log(
        'Events:',
        events.map(e => `${e.date}: ${e.isAppointment ? 'APPOINTMENT' : 'CESSATION'} (${e.type})`)
      );

      // Determine current status by processing events chronologically
      let isCurrentlyActive = false;
      let latestActiveDate = null;
      let latestAppointmentType = null;

      events.forEach(event => {
        if (event.isAppointment) {
          // Appointment/reelection makes position active
          isCurrentlyActive = true;
          latestActiveDate = event.date;
          latestAppointmentType = event.type;
          console.log(`  ${event.date}: APPOINTED - now ACTIVE`);
        } else if (event.isCessation) {
          // Cessation/revocation makes position inactive
          isCurrentlyActive = false;
          console.log(`  ${event.date}: CEASED - now INACTIVE`);
        }
      });

      console.log(`Final status for ${key}: ${isCurrentlyActive ? 'ACTIVE' : 'INACTIVE'}`);

      // Add to current state if active
      if (isCurrentlyActive) {
        const officerName = events[0].name;
        if (!currentState.has(officerName)) {
          currentState.set(officerName, {
            name: officerName,
            positions: [],
            history: [],
          });
        }

        currentState.get(officerName).positions.push({
          position: events[0].position,
          since: latestActiveDate,
          type: latestAppointmentType,
          company: events[0].rawData.company_name,
        });
      }

      // Add all events to history regardless of current status
      const officerName = events[0].name;
      if (!currentState.has(officerName)) {
        currentState.set(officerName, {
          name: officerName,
          positions: [],
          history: [],
        });
      }

      currentState.get(officerName).history.push(...events);
    });

    return {
      currentOfficers: Array.from(currentState.values()).filter(
        officer => officer.positions.length > 0
      ),
      allOfficers: Array.from(currentState.values()),
      timeline: timeline,
      totalEvents: timeline.length,
    };
  }

  /**
   * Format officers search results with enhanced temporal analysis
   */
  formatOfficersResults(apiResponse, companyName) {
    const metadata = {
      company: companyName,
      queryType: apiResponse.data?.rawData?.queryType || 'officer_search',
      timestamp: new Date().toISOString(),
      source: 'spanish_borme_database',
    };

    let officers = [];
    let currentOfficers = [];
    let pastOfficers = [];

    if (apiResponse.data?.rawData?.officers && Array.isArray(apiResponse.data.rawData.officers)) {
      // Calculate current vs past officer status using temporal analysis
      const officerAnalysis = this.calculateCurrentOfficerState(apiResponse.data.rawData.officers);

      // Format current officers
      currentOfficers = officerAnalysis.currentOfficers.map(officer => ({
        name: officer.name,
        positions: officer.positions,
        status: 'active',
        latestAppointment: officer.positions[0]?.since,
        source: 'borme',
        analysisConfidence: 'high',
      }));

      // Format all officers (including past ones) with improved status determination
      officers = apiResponse.data.rawData.officers.map(officer => {
        // Check if this officer is currently active using multiple criteria
        const isCurrentlyActive = currentOfficers.some(
          current =>
            current.name === officer.name &&
            current.positions.some(pos => pos.position === officer.position)
        );

        // Fallback status determination if temporal analysis doesn't catch it
        let status = 'unknown';
        if (isCurrentlyActive) {
          status = 'active';
        } else if (officer.status === 'ceased' || officer.removal_date) {
          status = 'past';
        } else if (
          officer.status === 'active' ||
          (!officer.removal_date && officer.appointment_date)
        ) {
          status = 'active';
        }

        return {
          name: officer.name,
          position: officer.position,
          company: officer.company_name,
          status,
          appointmentDate: officer.appointment_date || officer.date,
          removalDate: officer.removal_date,
          eventType: officer.event_type,
          source: 'borme',
          analysisMethod: 'temporal_chronological',
          rawStatus: officer.status, // Keep original for debugging
        };
      });

      // Separate past officers
      pastOfficers = officers.filter(o => o.status === 'past');
    }

    return {
      success: true,
      officers,
      currentOfficers,
      pastOfficers,
      total: officers.length,
      currentCount: currentOfficers.length,
      pastCount: pastOfficers.length,
      metadata,
      answer: this.safeExtractAnswer(apiResponse),
      rawResponse: apiResponse,
      temporalAnalysis: {
        hasTemporalAnalysis: true,
        analysisMethod: 'chronological_event_sequencing',
        confidence: 'high',
      },
    };
  }

  /**
   * Format person search results
   */
  formatPersonResults(apiResponse, personName) {
    const positions = [];
    const companies = new Set();
    const metadata = {
      person: personName,
      queryType: apiResponse.data?.rawData?.queryType || 'person_search',
      timestamp: new Date().toISOString(),
      source: 'spanish_borme_database',
    };

    if (apiResponse.data?.rawData?.officers && Array.isArray(apiResponse.data.rawData.officers)) {
      apiResponse.data.rawData.officers.forEach(officer => {
        companies.add(officer.company_name);
        positions.push({
          name: officer.name,
          position: officer.position,
          company: officer.company_name,
          status: officer.status || 'unknown',
          appointmentDate: officer.appointment_date,
          removalDate: officer.removal_date,
          source: 'borme',
        });
      });
    }

    return {
      success: true,
      person: personName,
      positions,
      companies: Array.from(companies),
      totalPositions: positions.length,
      totalCompanies: companies.size,
      metadata,
      answer: this.safeExtractAnswer(apiResponse),
      rawResponse: apiResponse,
    };
  }

  /**
   * Format relationship analysis results
   */
  formatRelationshipResults(apiResponse, company1, company2) {
    const relationships = [];
    const metadata = {
      companies: [company1, company2],
      queryType: apiResponse.data?.rawData?.queryType || 'relationship_analysis',
      timestamp: new Date().toISOString(),
      source: 'spanish_borme_database',
    };

    // Extract relationship information from the response
    if (apiResponse.data?.rawData?.officers && Array.isArray(apiResponse.data.rawData.officers)) {
      const sharedOfficers = new Map();

      apiResponse.data.rawData.officers.forEach(officer => {
        const officerKey = officer.name;
        if (!sharedOfficers.has(officerKey)) {
          sharedOfficers.set(officerKey, {
            name: officer.name,
            companies: [],
            positions: [],
          });
        }

        sharedOfficers.get(officerKey).companies.push(officer.company_name);
        sharedOfficers.get(officerKey).positions.push({
          company: officer.company_name,
          position: officer.position,
          status: officer.status,
        });
      });

      // Find officers that appear in multiple companies
      for (const [name, data] of sharedOfficers.entries()) {
        if (data.companies.length > 1) {
          relationships.push({
            type: 'shared_officer',
            officer: name,
            companies: data.companies,
            positions: data.positions,
          });
        }
      }
    }

    return {
      success: true,
      company1,
      company2,
      relationships,
      totalRelationships: relationships.length,
      metadata,
      answer: this.safeExtractAnswer(apiResponse),
      rawResponse: apiResponse,
    };
  }

  /**
   * Intelligent query interpretation for Spanish companies
   */
  interpretQuery(query) {
    const queryLower = query.toLowerCase();

    // Director/officer patterns
    const officerPatterns = [
      'administrador',
      'director',
      'consejero',
      'apoderado',
      'presidente',
      'secretario',
      'vocal',
      'quien',
      'quienes',
      'cargo',
      'directivos',
    ];

    // Relationship patterns
    const relationshipPatterns = [
      'relación',
      'relacionado',
      'conectado',
      'conexión',
      'vínculo',
      'entre',
      'común',
      'compartido',
      'compartida',
    ];

    // Person name patterns (typically 2-4 words, properly capitalized)
    const isPersonName =
      query.split(' ').length >= 2 &&
      query.split(' ').length <= 4 &&
      /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+$/.test(query.trim());

    // Company name patterns
    const companyPatterns = ['sl', 'sa', 'sociedad', 'empresa', 'grupo', 'compañía', 'consulting'];
    const hasCompanyIndicator = companyPatterns.some(pattern => queryLower.includes(pattern));

    // Determine query type
    if (relationshipPatterns.some(pattern => queryLower.includes(pattern))) {
      return { type: 'relationship_analysis', confidence: 0.9 };
    } else if (officerPatterns.some(pattern => queryLower.includes(pattern))) {
      return { type: 'officer_search', confidence: 0.8 };
    } else if (isPersonName && !hasCompanyIndicator) {
      return { type: 'person_search', confidence: 0.7 };
    } else if (hasCompanyIndicator) {
      return { type: 'company_search', confidence: 0.6 };
    } else {
      return { type: 'general_search', confidence: 0.5 };
    }
  }

  /**
   * Main search method that intelligently routes queries
   */
  async intelligentSearch(query, options = {}) {
    try {
      const interpretation = this.interpretQuery(query);
      console.log(`Spanish Companies: Query interpretation:`, interpretation);

      // Pass through streaming options to the specific search methods
      const searchOptions = {
        ...options,
        stream: options.stream || false,
        onStreamChunk: options.onStreamChunk || null,
      };

      switch (interpretation.type) {
        case 'officer_search': {
          // Extract company name from the query
          const companyMatch = query.match(/de\s+([^?]+)/i);
          const companyName = companyMatch ? companyMatch[1].trim() : query;
          return await this.searchOfficers(companyName, searchOptions);
        }

        case 'person_search':
          return await this.searchPerson(query, searchOptions);

        case 'relationship_analysis': {
          // Try to extract two company names
          const companies = query.split(/\s+y\s+|\s+entre\s+/).filter(c => c.trim().length > 3);
          if (companies.length >= 2) {
            return await this.analyzeRelationships(
              companies[0].trim(),
              companies[1].trim(),
              searchOptions
            );
          }
          // Fall back to general search
          return await this.searchCompanies(query, searchOptions);
        }

        case 'company_search':
        case 'general_search':
        default:
          return await this.searchCompanies(query, searchOptions);
      }
    } catch (error) {
      console.error('Intelligent search failed:', error);
      throw error;
    }
  }

  /**
   * Detect if a query is a simple company name (vs a complex question)
   */
  isSimpleCompanyName(query) {
    const queryLower = query.toLowerCase().trim();

    // Question words that indicate complex queries
    const questionWords = [
      'quien',
      'quienes',
      'que',
      'cual',
      'cuales',
      'como',
      'cuando',
      'donde',
      'por que',
      'porque',
    ];
    const hasQuestionWords = questionWords.some(word => queryLower.includes(word));

    // Action words that indicate complex queries
    const actionWords = [
      'administrador',
      'director',
      'consejero',
      'relacion',
      'conectado',
      'vinculo',
    ];
    const hasActionWords = actionWords.some(word => queryLower.includes(word));

    // Company indicators
    const companyIndicators = [
      'sl',
      'sa',
      'slu',
      'slne',
      'sociedad',
      'empresa',
      'grupo',
      'compañia',
      'consulting',
      'associates',
      'corp',
      'inc',
      'ltd',
    ];
    const hasCompanyIndicators = companyIndicators.some(indicator =>
      queryLower.includes(indicator)
    );

    // If it has question/action words, it's a complex query
    if (hasQuestionWords || hasActionWords) {
      return false;
    }

    // If it has company indicators and is relatively short (2-6 words), likely a company name
    const wordCount = query.trim().split(/\s+/).length;
    if (hasCompanyIndicators && wordCount >= 2 && wordCount <= 6) {
      return true;
    }

    // If it's 2-4 words and doesn't contain obvious question patterns, might be a company name
    if (wordCount >= 2 && wordCount <= 4 && !queryLower.includes('?')) {
      return true;
    }

    return false;
  }

  /**
   * Format results from the direct working-search endpoint
   */
  formatDirectSearchResults(apiResponse, originalQuery) {
    const companies = [];
    const metadata = {
      query: originalQuery,
      queryType: 'direct_company_search',
      timestamp: new Date().toISOString(),
      source: 'spanish_borme_database_direct',
    };

    // working-search returns { results: [...] }
    if (apiResponse.results && Array.isArray(apiResponse.results)) {
      // Convert working-search results to the expected format
      apiResponse.results.forEach(result => {
        companies.push({
          name: result.company_name || result.name || 'Unknown Company',
          type: 'company',
          content: result.full_entry || `Found: ${result.company_name || result.name}`,
          source: 'borme',
          score: result._score || result.score || 0,
          identifier: result.identifier || null,
          // Expose all the rich data at top level for easy access
          full_entry: result.full_entry || '',
          parsed_details: result.parsed_details || {},
          officers: result.officers || [],
          indexed_date: result.indexed_date || '',
          pdf_url: result.pdf_url || '',
          entry_type: result.entry_type || [],
          sole_shareholders: result.sole_shareholders || [],
          rawData: result,
        });
      });

      // Create a summary content for display
      const summaryContent = `**Companies Found:**\n\n${companies
        .map(
          (company, index) =>
            `${index + 1}. **${company.name}**${company.identifier ? ` (ID: ${company.identifier})` : ''}`
        )
        .join('\n')}\n\n*Found ${companies.length} matching companies in BORME database.*`;

      companies.unshift({
        name: 'Search Results',
        type: 'search_result',
        content: summaryContent,
        source: 'borme',
      });
    } else {
      // No results found
      companies.push({
        name: 'Search Results',
        type: 'search_result',
        content: `No companies found matching "${originalQuery}" in the BORME database.`,
        source: 'borme',
      });
    }

    return {
      companies,
      metadata,
      success: true,
    };
  }

  /**
   * Get company by exact name using autocomplete + smartQuery for full data
   * This is more reliable than directory search for exact matches
   *
   * @param {string} companyName - Exact company name (from autocomplete selection)
   * @returns {Promise<Object>} Company data with full profile
   */
  async getCompanyByExactName(companyName) {
    try {
      console.log(`🎯 Getting company by exact name: "${companyName}"`);

      // Use autocomplete with the exact name - it should return as first result
      const result = await this.autocompleteCompanies(companyName, { limit: 5 });

      if (result.suggestions && result.suggestions.length > 0) {
        // Find exact match in suggestions
        const exactMatch = result.suggestions.find(
          s => s.name.toUpperCase().trim() === companyName.toUpperCase().trim()
        );

        if (exactMatch) {
          console.log(`🎯 Found exact match: "${exactMatch.name}"`);

          // Now fetch full company profile using smartQuery
          console.log(`🎯 Fetching full profile for: "${exactMatch.name}"`);
          const profileResult = await this.smartQuery(
            `Información completa de ${exactMatch.name}`,
            exactMatch.name // Pass exact name to bypass LLM extraction
          );

          // Extract profile data
          const profile = profileResult.profile || {};
          const officers = [];
          const publications = [];
          const seenOfficers = new Set();

          // Debug: log profile structure to understand what data is available
          console.log('🔍 Profile structure:', {
            hasDirectivosActuales: !!profile.directivos_actuales,
            directivosActualesCount: profile.directivos_actuales?.length || 0,
            hasCronologiaDirectivos: !!profile.cronologia_directivos,
            cronologiaDirectivosCount: profile.cronologia_directivos?.length || 0,
            hasHistorialEventos: !!profile.historial_eventos,
            historialEventosCount: profile.historial_eventos?.length || 0,
            profileKeys: Object.keys(profile),
            sampleDirectivo: profile.directivos_actuales?.[0] || null,
            sampleCronologia: profile.cronologia_directivos?.[0] || null,
          });

          // Extract current officers from profile.directivos_actuales
          if (profile.directivos_actuales && Array.isArray(profile.directivos_actuales)) {
            profile.directivos_actuales.forEach(directivo => {
              const name = directivo.nombre || directivo.name || directivo;
              if (name && typeof name === 'string' && !seenOfficers.has(name)) {
                seenOfficers.add(name);
                officers.push({
                  name: name,
                  role: directivo.cargo || directivo.role || 'Directivo',
                  date: directivo.fecha_nombramiento || directivo.fecha || directivo.date,
                  status: 'active',
                });
              }
            });
          }

          // Extract officer history from profile.cronologia_directivos
          if (profile.cronologia_directivos && Array.isArray(profile.cronologia_directivos)) {
            profile.cronologia_directivos.forEach(entry => {
              const name = entry.nombre || entry.name || entry.directivo;
              if (name && typeof name === 'string' && !seenOfficers.has(name)) {
                seenOfficers.add(name);
                officers.push({
                  name: name,
                  role: entry.cargo || entry.role || 'Directivo',
                  date: entry.fecha || entry.date,
                  status: entry.tipo?.toLowerCase().includes('cese') ? 'ceased' : 'active',
                });
              }
            });
          }

          // Fallback: Extract officers from profile.administradores_actuales if available
          if (profile.administradores_actuales && Array.isArray(profile.administradores_actuales)) {
            profile.administradores_actuales.forEach(admin => {
              const name = admin.nombre || admin.name;
              if (name && !seenOfficers.has(name)) {
                seenOfficers.add(name);
                officers.push({
                  name: name,
                  role: admin.cargo || admin.role || 'Administrador',
                  date: admin.fecha_nombramiento || admin.date,
                  status: 'active',
                });
              }
            });
          }

          // Extract events as publications AND extract officers from events
          if (profile.historial_eventos && Array.isArray(profile.historial_eventos)) {
            profile.historial_eventos.forEach(evento => {
              publications.push({
                date: evento.fecha,
                type: evento.tipo,
                details: evento.detalles,
                officers: evento.personas || [],
              });

              // Extract officers from events (nombramientos, ceses, etc.)
              if (evento.personas && Array.isArray(evento.personas)) {
                evento.personas.forEach(persona => {
                  const name = persona.nombre || persona.name || persona;
                  if (name && typeof name === 'string' && !seenOfficers.has(name)) {
                    seenOfficers.add(name);
                    officers.push({
                      name: name,
                      role: persona.cargo || persona.role || evento.tipo || 'Cargo',
                      date: evento.fecha,
                      status: evento.tipo?.toLowerCase().includes('cese') ? 'ceased' : 'active',
                    });
                  }
                });
              }

              // Also check for detalles which might contain officer names
              if (evento.detalles && typeof evento.detalles === 'string') {
                // Look for common patterns like "Nombramientos: JUAN PEREZ (ADMINISTRADOR)"
                const nombrePattern =
                  /(?:Nombramientos?|Ceses?|Revocaciones?):\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,]+?)(?:\s*\(([^)]+)\))?(?:\.|$)/gi;
                let match;
                while ((match = nombrePattern.exec(evento.detalles)) !== null) {
                  const names = match[1]
                    .split(',')
                    .map(n => n.trim())
                    .filter(n => n.length > 2);
                  const role = match[2] || evento.tipo || 'Cargo';
                  names.forEach(name => {
                    if (name && !seenOfficers.has(name) && name.length > 3) {
                      seenOfficers.add(name);
                      officers.push({
                        name: name,
                        role: role,
                        date: evento.fecha,
                        status: evento.tipo?.toLowerCase().includes('cese') ? 'ceased' : 'active',
                      });
                    }
                  });
                }
              }
            });
          }

          // Also try to extract from raw BORME data if present
          if (profile.cargos && Array.isArray(profile.cargos)) {
            profile.cargos.forEach(cargo => {
              const name = cargo.nombre || cargo.name;
              if (name && !seenOfficers.has(name)) {
                seenOfficers.add(name);
                officers.push({
                  name: name,
                  role: cargo.cargo || cargo.role || 'Cargo',
                  date: cargo.fecha || cargo.date,
                  status: cargo.estado || 'unknown',
                });
              }
            });
          }

          // Build comprehensive company object
          const companyData = {
            company_name: exactMatch.name,
            name: exactMatch.name,
            identifier: exactMatch.identifier,
            // Profile data - use correct field names from backend
            cif: profile.cif,
            domicilio: profile.domicilio_actual || profile.domicilio,
            objeto_social: profile.objeto_social,
            capital_social: profile.capital_social,
            fecha_constitucion: profile.fecha_constitucion,
            forma_juridica: profile.forma_juridica,
            denominacion_social: profile.denominacion_social,
            datos_registrales: profile.datos_registrales,
            // Officers - from extracted list
            officers: officers,
            // Also include raw officer arrays for detailed rendering
            directivos_actuales: profile.directivos_actuales || [],
            cronologia_directivos: profile.cronologia_directivos || [],
            administradores_actuales: profile.administradores_actuales || [],
            administradores_historicos: profile.administradores_historicos || [],
            // Publications / Events
            publications: publications,
            historial_eventos: profile.historial_eventos || [],
            publication_count: profileResult.totalRecords || publications.length,
            first_publication: profile.primera_publicacion,
            last_publication: profile.ultima_publicacion || profile.fecha_ultima_actualizacion,
            // Raw profile for detailed rendering
            _profile: profile,
            _raw: {
              ...exactMatch,
              profile: profile,
              answer: profileResult.answer,
            },
          };

          console.log(
            `🎯 Full profile loaded: ${officers.length} officers, ${publications.length} events`
          );

          return {
            success: true,
            companies: [companyData],
            total: 1,
            query: companyName,
            hasFullProfile: true,
          };
        }
      }

      console.log(`🎯 No exact match found for "${companyName}"`);
      return {
        success: true,
        companies: [],
        total: 0,
        query: companyName,
      };
    } catch (error) {
      console.error('Get company by exact name failed:', error);
      return { success: false, error: error.message, companies: [] };
    }
  }

  /**
   * Search the BORME Company Directory (borme_companies index)
   * This contains ALL known publications from -99.pdf index files
   * Use this to find publications that may not be fully parsed in borme_v2
   *
   * @param {string} companyName - Company name to search
   * @param {Object} options - Search options
   * @param {boolean} options.exactMatch - If true, use exact name lookup (from autocomplete)
   * @returns {Promise<Object>} Directory entry with all known publications
   */
  async searchDirectory(companyName, options = {}) {
    const { size = 5, exactMatch = false } = options;

    // If exactMatch is requested, use the more reliable exact name lookup
    if (exactMatch) {
      return this.getCompanyByExactName(companyName);
    }

    try {
      console.log(`📂 Directory Search: "${companyName}"`);

      // Normalize the search term
      const normalizedSearch = companyName.toUpperCase().trim();

      const response = await fetch(
        `${this.baseUrl}/bormes/companies/directory?q=${encodeURIComponent(companyName)}&size=${size}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-API-Key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        // Directory might not exist yet - return empty result
        if (response.status === 404) {
          console.log('📂 Directory index not found (may still be building)');
          return { success: true, companies: [], total: 0 };
        }
        throw new Error(`Directory API error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        return { success: false, error: result.error, companies: [] };
      }

      // Filter results to only include good matches
      // The API returns fuzzy matches, so we need to validate
      const companies = (result.companies || []).filter(company => {
        const foundName = (company.company_name || '').toUpperCase().trim();

        // Check for reasonable match:
        // 1. Exact match
        if (foundName === normalizedSearch) return true;

        // 2. One contains the other (for partial names)
        if (foundName.includes(normalizedSearch) || normalizedSearch.includes(foundName))
          return true;

        // 3. Match without suffixes (common Spanish company suffixes)
        const suffixPattern =
          /\s*(SL|SA|SLU|SAU|SLL|SLP|SLNE|SOCIEDAD LIMITADA|SOCIEDAD ANONIMA)\.?\s*(\(R\.M\..*\))?\.?\s*$/i;
        const searchBase = normalizedSearch.replace(suffixPattern, '').trim();
        const foundBase = foundName.replace(suffixPattern, '').trim();

        if (searchBase === foundBase) return true;
        if (searchBase.length > 5 && foundBase.includes(searchBase)) return true;
        if (foundBase.length > 5 && searchBase.includes(foundBase)) return true;

        // 4. Check if main words match (at least 2 significant words)
        const searchWords = searchBase.split(/\s+/).filter(w => w.length > 2);
        const foundWords = foundBase.split(/\s+/).filter(w => w.length > 2);
        const matchingWords = searchWords.filter(w => foundWords.includes(w));

        if (matchingWords.length >= 2 && matchingWords.length >= searchWords.length * 0.5)
          return true;

        // 5. If exactMatch is requested (from autocomplete), also accept if foundName starts with search base
        if (exactMatch && foundBase.startsWith(searchBase.split(' ')[0])) return true;

        return false;
      });

      console.log(
        `📂 Directory: ${result.companies?.length || 0} results, ${companies.length} good matches`
      );

      return {
        success: true,
        companies: companies,
        total: companies.length,
        query: companyName,
      };
    } catch (error) {
      console.error('Directory search failed:', error);
      // Don't throw - directory is optional enhancement
      return { success: false, error: error.message, companies: [] };
    }
  }

  /**
   * Get publications for a specific company from the directory
   * Returns the full list of known BORME publications
   *
   * @param {string} companyId - Company document ID from directory
   * @returns {Promise<Object>} Company with all publications
   */
  async getDirectoryCompany(companyId) {
    try {
      console.log(`📂 Getting directory company: ${companyId}`);

      const response = await fetch(
        `${this.baseUrl}/bormes/companies/directory/${encodeURIComponent(companyId)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-API-Key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Directory API error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Get directory company failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Compare borme_v2 profile with directory to find missing publications
   *
   * @param {Object} profile - Profile from smartQuery (borme_v2)
   * @param {Object} directoryEntry - Entry from searchDirectory
   * @returns {Object} Comparison with missing entries
   */
  compareWithDirectory(profile, directoryEntry) {
    if (!directoryEntry || !directoryEntry.publications) {
      return {
        hasCoverage: false,
        directoryCount: 0,
        profileCount: 0,
        missingCount: 0,
        missingEntries: [],
      };
    }

    const directoryPublications = directoryEntry.publications || [];
    const profileEvents = profile?.historial_eventos || [];

    // Extract dates from profile events for comparison
    const profileDates = new Set(profileEvents.map(e => e.fecha).filter(Boolean));

    // Find publications in directory that aren't in profile
    const missingEntries = directoryPublications.filter(pub => {
      const pubDate = pub.date;
      // Simple date comparison - could be enhanced
      return !profileDates.has(pubDate);
    });

    return {
      hasCoverage: true,
      directoryCount: directoryPublications.length,
      profileCount: profileEvents.length,
      missingCount: missingEntries.length,
      missingEntries: missingEntries,
      coveragePercent:
        directoryPublications.length > 0
          ? Math.round((1 - missingEntries.length / directoryPublications.length) * 100)
          : 100,
    };
  }

  /**
   * Fetch a BORME PDF and extract its text (for on-demand parsing)
   *
   * @param {string} bormeId - BORME identifier (e.g., "BORME-A-2024-123-45")
   * @param {string} date - Publication date (e.g., "2024-06-15")
   * @returns {Promise<Object>} Extracted text or error
   */
  async fetchBormePdf(bormeId, date) {
    try {
      console.log(`📄 Fetching BORME PDF: ${bormeId} (${date})`);

      // Construct PDF URL from BORME ID
      // Format: BORME-A-YYYY-NNN-PP -> /borme/dias/YYYY/MM/DD/pdfs/BORME-A-YYYY-NNN-PP.pdf
      const dateParts = date.split('-');
      if (dateParts.length !== 3) {
        throw new Error('Invalid date format');
      }

      const [year, month, day] = dateParts;
      const pdfUrl = `https://www.boe.es/borme/dias/${year}/${month}/${day}/pdfs/${bormeId}.pdf`;

      console.log(`📄 PDF URL: ${pdfUrl}`);

      // For now, return the URL - actual PDF fetching would require backend support
      // to avoid CORS issues and do text extraction
      return {
        success: true,
        pdfUrl: pdfUrl,
        bormeId: bormeId,
        date: date,
        // TODO: Add backend endpoint for PDF text extraction
        message: 'PDF URL generated. Backend extraction not yet implemented.',
      };
    } catch (error) {
      console.error('Fetch BORME PDF failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * NEW: Smart Query endpoint with proper aggregation
   * Uses /bormes/smart-query which aggregates ALL records before answering
   *
   * @param {string} query - Natural language question
   * @param {string} exactCompanyName - OPTIONAL: Exact company name from chip/autocomplete
   * @returns {Promise<Object>} Structured answer with aggregated company profile
   */
  async smartQuery(query, exactCompanyName = null) {
    try {
      console.log(`🧠 Smart Query: "${query}"`);
      if (exactCompanyName) {
        console.log(`📌 Using exact company name: "${exactCompanyName}"`);
      }

      const requestBody = { query };

      // Add exact company name if provided (bypasses name extraction)
      if (exactCompanyName) {
        requestBody.company_name = exactCompanyName;
      }

      const response = await fetch(`${this.baseUrl}/bormes/smart-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Smart query API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Smart query failed');
      }

      // Return the structured result
      return {
        success: true,
        answer: result.answer,
        companyName: result.company_name,
        profile: result.profile,
        totalRecords: result.total_records,
        method: result.method,
      };
    } catch (error) {
      console.error('Smart query failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Resolve exact company name from directory (borme_companies index)
   * Useful for correcting company names that may have special characters stripped
   * during elasticsearch indexing (e.g., "FTI & PARTNERS" -> "FTI PARTNERS")
   *
   * @param {string} normalizedName - Company name that may have been normalized
   * @returns {Promise<string>} The exact company name from directory, or original if not found
   */
  async resolveExactCompanyName(normalizedName) {
    if (!normalizedName || normalizedName.trim().length < 3) {
      return normalizedName;
    }

    try {
      // Search directory for the company
      const result = await this.searchDirectory(normalizedName, { size: 3 });

      if (result.success && result.companies?.length > 0) {
        // Find the best match - exact match first, then closest match
        const searchUpper = normalizedName.toUpperCase().trim();

        // Check for exact match (accounting for possible special char differences)
        for (const company of result.companies) {
          const dirName = (company.company_name || '').toUpperCase().trim();

          // If directory name contains the search term as base (without special chars)
          const dirNameNormalized = dirName.replace(/[&]/g, '').replace(/\s+/g, ' ').trim();
          const searchNormalized = searchUpper.replace(/[&]/g, '').replace(/\s+/g, ' ').trim();

          if (dirNameNormalized === searchNormalized) {
            console.log(
              `📂 Resolved company name: "${normalizedName}" -> "${company.company_name}"`
            );
            return company.company_name;
          }
        }

        // If no exact match, return the first result if it's close enough
        const firstMatch = result.companies[0];
        const firstNameNorm = (firstMatch.company_name || '')
          .toUpperCase()
          .replace(/[&]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        const searchNorm = searchUpper.replace(/[&]/g, '').replace(/\s+/g, ' ').trim();

        // Check if first 50% of words match
        const firstWords = firstNameNorm.split(' ');
        const searchWords = searchNorm.split(' ');
        const matchingWords = searchWords.filter(w => firstWords.includes(w));

        if (matchingWords.length >= Math.min(2, searchWords.length * 0.5)) {
          console.log(
            `📂 Resolved company name (partial): "${normalizedName}" -> "${firstMatch.company_name}"`
          );
          return firstMatch.company_name;
        }
      }
    } catch (error) {
      console.warn(`Failed to resolve exact company name for "${normalizedName}":`, error);
    }

    return normalizedName;
  }

  /**
   * Batch resolve multiple company names from directory
   * More efficient than resolving one by one for officer search results
   *
   * @param {string[]} companyNames - Array of company names to resolve
   * @returns {Promise<Map<string, string>>} Map of normalized name -> exact name
   */
  async resolveCompanyNamesBatch(companyNames) {
    const nameMap = new Map();
    const uniqueNames = [...new Set(companyNames.filter(n => n && n.trim().length >= 3))];

    if (uniqueNames.length === 0) {
      return nameMap;
    }

    console.log(`📂 Batch resolving ${uniqueNames.length} company names from directory`);

    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < uniqueNames.length; i += batchSize) {
      const batch = uniqueNames.slice(i, i + batchSize);

      // Resolve in parallel within each batch
      const results = await Promise.all(
        batch.map(async name => {
          const exactName = await this.resolveExactCompanyName(name);
          return { normalized: name, exact: exactName };
        })
      );

      results.forEach(({ normalized, exact }) => {
        nameMap.set(normalized, exact);
      });
    }

    console.log(`📂 Resolved ${nameMap.size} company names`);
    return nameMap;
  }

  /**
   * Get companies that a specific company is the sole shareholder of
   * Uses the /bormes/sole-shareholder-companies endpoint
   *
   * @param {string} shareholderName - Name of the company to search as sole shareholder
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results (default 100)
   * @returns {Promise<Object>} Companies owned by this shareholder
   */
  async getCompaniesOwnedByShareholder(shareholderName, options = {}) {
    const { limit = 100 } = options;

    if (!shareholderName || shareholderName.trim().length < 3) {
      return { success: true, companies: [], total: 0 };
    }

    try {
      console.log(`🏢 Getting companies owned by: "${shareholderName}"`);

      const response = await this.fetchWithRetry(
        `${this.baseUrl}/bormes/sole-shareholder-companies`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shareholder_name: shareholderName.trim(),
            limit: limit,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sole shareholder companies API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        return { success: false, error: result.error, companies: [] };
      }

      console.log(`🏢 Found ${result.total || 0} companies owned by "${shareholderName}"`);

      return {
        success: true,
        companies: result.companies || [],
        total: result.total || 0,
        shareholderName: shareholderName,
      };
    } catch (error) {
      console.error('Get companies owned by shareholder failed:', error);
      return { success: false, error: error.message, companies: [] };
    }
  }

  /**
   * Get the sole shareholder(s) OF a specific company (who owns this company)
   * Uses the /bormes/company-sole-shareholder endpoint
   *
   * @param {string} companyName - Name of the company to get shareholders for
   * @returns {Promise<Object>} Sole shareholder data for this company
   */
  async getCompanySoleShareholderData(companyName) {
    if (!companyName || companyName.trim().length < 3) {
      return { success: true, sole_shareholders: [], sole_shareholder_lost: false };
    }

    try {
      console.log(`🏢 Getting sole shareholder data for: "${companyName}"`);

      const response = await this.fetchWithRetry(
        `${this.baseUrl}/bormes/company-sole-shareholder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_name: companyName.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Company sole shareholder API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          sole_shareholders: [],
          sole_shareholder_lost: false,
        };
      }

      console.log(
        `🏢 Found sole shareholder data for "${companyName}": ${result.sole_shareholders?.length || 0} shareholders`
      );

      return {
        success: true,
        sole_shareholders: result.sole_shareholders || [],
        sole_shareholder_lost: result.sole_shareholder_lost || false,
        company_name: companyName,
      };
    } catch (error) {
      console.error('Get company sole shareholder data failed:', error);
      return {
        success: false,
        error: error.message,
        sole_shareholders: [],
        sole_shareholder_lost: false,
      };
    }
  }
}

// Export singleton instance
export const spanishCompaniesService = new SpanishCompaniesService();
