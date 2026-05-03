(function () {
  const config = window.APP_CONFIG || {};
  const professorPin = String(config.professorPin || "1234");
  const localStorageKey = "saas-demo-announcements";
  const refreshIntervalMs = 15000;
  const localVisibilityStorageKey = "saas-demo-visibility";
  const visibilityPollMs = 5000;

  const elements = {
    form: document.getElementById("announcementForm"),
    title: document.getElementById("title"),
    message: document.getElementById("message"),
    audience: document.getElementById("audience"),
    pin: document.getElementById("pin"),
    feedback: document.getElementById("formFeedback"),
    teacherFeedback: document.getElementById("teacherConsoleFeedback"),
    list: document.getElementById("announcementList"),
    count: document.getElementById("announcementCount"),
    lastSync: document.getElementById("lastSync"),
    modeBadge: document.getElementById("modeBadge"),
    modeDescription: document.getElementById("modeDescription"),
    refreshButton: document.getElementById("refreshButton"),
    seedButton: document.getElementById("seedButton"),
    clearButton: document.getElementById("clearButton"),
    toggleGithubButton: document.getElementById("toggleGithubButton"),
    toggleDogButton: document.getElementById("toggleDogButton"),
    togglePokemonButton: document.getElementById("togglePokemonButton"),
    toggleMoviesButton: document.getElementById("toggleMoviesButton"),
    githubSection: document.getElementById("githubSection"),
    githubIntegration: document.getElementById("githubIntegration"),
    dogSection: document.getElementById("dogSection"),
    dogBreedSelect: document.getElementById("dogBreedSelect"),
    dogFetchButton: document.getElementById("dogFetchButton"),
    dogSurpriseButton: document.getElementById("dogSurpriseButton"),
    dogIntegration: document.getElementById("dogIntegration"),
    pokemonSection: document.getElementById("pokemonSection"),
    pokemonSelect: document.getElementById("pokemonSelect"),
    pokemonFetchButton: document.getElementById("pokemonFetchButton"),
    pokemonRandomButton: document.getElementById("pokemonRandomButton"),
    pokemonIntegration: document.getElementById("pokemonIntegration"),
    moviesSection: document.getElementById("moviesSection"),
    movieCategorySelect: document.getElementById("movieCategorySelect"),
    movieFetchButton: document.getElementById("movieFetchButton"),
    moviesIntegration: document.getElementById("moviesIntegration")
  };

  const sampleAnnouncement = {
    title: "Apresentações remarcadas",
    message: "O grupo Azure apresentará primeiro e o grupo AWS ficou para o segundo bloco da aula.",
    audience: "Todos"
  };

  let client = null;
  let mode = "local";
  let dogBreeds = [];
  let pokemonList = [];
  let presentationStateAvailable = true;
  let sectionVisibility = {
    github: false,
    dogs: false,
    pokemon: false,
    movies: false
  };

  function isMissingPresentationStateError(error) {
    if (!error) return false;

    const message = String(error.message || "").toLowerCase();
    return (
      message.includes("presentation_state") &&
      (message.includes("schema cache") || message.includes("could not find the table") || message.includes("relation"))
    );
  }

  function getGithubRepoPath() {
    const owner = config.githubRepoOwner || "etecreginaldocandido";
    const repo = config.githubRepoName || "saas_exemplo";
    return `${owner}/${repo}`;
  }

  function isCloudModeReady() {
    return Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  }

  function setModeUi() {
    if (mode === "cloud") {
      elements.modeBadge.textContent = "Modo nuvem ativo";
      elements.modeBadge.classList.add("cloud");
      elements.modeDescription.textContent =
        "Avisos e visibilidade das integrações estão sincronizados pela nuvem para todos os participantes.";
      return;
    }

    elements.modeBadge.textContent = "Modo local de demonstração";
    elements.modeBadge.classList.remove("cloud");
    elements.modeDescription.textContent =
      "Sem configuração completa de nuvem. O sistema funciona localmente, mas a apresentação compartilhada exige Supabase.";
  }

  function setFeedback(message, type) {
    elements.feedback.textContent = message;
    elements.feedback.className = "feedback";
    if (type) {
      elements.feedback.classList.add(type);
    }
  }

  function setTeacherFeedback(message, type) {
    elements.teacherFeedback.textContent = message;
    elements.teacherFeedback.className = "feedback";
    if (type) {
      elements.teacherFeedback.classList.add(type);
    }
  }

  function formatDate(isoDate) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(isoDate));
  }

  function updateStatus(count) {
    elements.count.textContent = String(count);
    elements.lastSync.textContent = formatDate(new Date().toISOString());
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalizeLabel(value) {
    return String(value)
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function setLocalVisibilityState() {
    localStorage.setItem(localVisibilityStorageKey, JSON.stringify(sectionVisibility));
  }

  function readLocalVisibilityState() {
    try {
      const raw = localStorage.getItem(localVisibilityStorageKey);
      if (!raw) return sectionVisibility;
      return { ...sectionVisibility, ...JSON.parse(raw) };
    } catch {
      return sectionVisibility;
    }
  }

  async function loadPresentationState() {
    if (mode !== "cloud" || !presentationStateAvailable) {
      sectionVisibility = readLocalVisibilityState();
      applySectionVisibility();
      return;
    }

    const { data, error } = await client
      .from("presentation_state")
      .select("github_visible, dogs_visible, pokemon_visible, movies_visible")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      if (isMissingPresentationStateError(error)) {
        presentationStateAvailable = false;
        sectionVisibility = readLocalVisibilityState();
        applySectionVisibility();
        setTeacherFeedback("A tabela presentation_state ainda não existe no Supabase. Usando controle local até ela ser criada.", "error");
        return;
      }

      throw error;
    }

    if (!data) {
      const defaultState = {
        id: 1,
        github_visible: false,
        dogs_visible: false,
        pokemon_visible: false,
        movies_visible: false
      };

      const { error: insertError } = await client.from("presentation_state").upsert(defaultState);
      if (insertError) {
        if (isMissingPresentationStateError(insertError)) {
          presentationStateAvailable = false;
          sectionVisibility = readLocalVisibilityState();
          applySectionVisibility();
          setTeacherFeedback("A tabela presentation_state ainda não existe no Supabase. Usando controle local até ela ser criada.", "error");
          return;
        }

        throw insertError;
      }

      sectionVisibility = {
        github: false,
        dogs: false,
        pokemon: false,
        movies: false
      };
      applySectionVisibility();
      return;
    }

    sectionVisibility = {
      github: Boolean(data.github_visible),
      dogs: Boolean(data.dogs_visible),
      pokemon: Boolean(data.pokemon_visible),
      movies: Boolean(data.movies_visible)
    };

    applySectionVisibility();
  }

  async function savePresentationState() {
    if (mode !== "cloud" || !presentationStateAvailable) {
      setLocalVisibilityState();
      return;
    }

    const payload = {
      id: 1,
      github_visible: sectionVisibility.github,
      dogs_visible: sectionVisibility.dogs,
      pokemon_visible: sectionVisibility.pokemon,
      movies_visible: sectionVisibility.movies,
      updated_at: new Date().toISOString()
    };

    const { error } = await client.from("presentation_state").upsert(payload);
    if (error) {
      if (isMissingPresentationStateError(error)) {
        presentationStateAvailable = false;
        setLocalVisibilityState();
        setTeacherFeedback("A tabela presentation_state ainda não existe no Supabase. A visibilidade foi salva apenas neste navegador.", "error");
        return;
      }

      throw error;
    }
  }

  function updateToggleButtons() {
    const controls = [
      { key: "github", element: elements.toggleGithubButton, label: "GitHub" },
      { key: "dogs", element: elements.toggleDogButton, label: "cães" },
      { key: "pokemon", element: elements.togglePokemonButton, label: "Pokémon" },
      { key: "movies", element: elements.toggleMoviesButton, label: "filmes" }
    ];

    controls.forEach(({ key, element, label }) => {
      const visible = sectionVisibility[key];
      element.textContent = visible ? `Ocultar ${label}` : `Mostrar ${label}`;
      element.classList.toggle("button-active", visible);
    });
  }

  function applySectionVisibility() {
    elements.githubSection.classList.toggle("is-hidden", !sectionVisibility.github);
    elements.dogSection.classList.toggle("is-hidden", !sectionVisibility.dogs);
    elements.pokemonSection.classList.toggle("is-hidden", !sectionVisibility.pokemon);
    elements.moviesSection.classList.toggle("is-hidden", !sectionVisibility.movies);
    updateToggleButtons();
  }

  function canUseTeacherControls() {
    if (elements.pin.value === professorPin) {
      return true;
    }

    setTeacherFeedback("Informe o PIN do professor para controlar a apresentação.", "error");
    return false;
  }

  function createAnnouncementMarkup(item) {
    return `
      <article class="announcement-item">
        <div class="announcement-meta">
          <span>Público: ${escapeHtml(item.audience || "Todos")}</span>
          <span>${formatDate(item.created_at)}</span>
        </div>
        <h3 class="announcement-title">${escapeHtml(item.title)}</h3>
        <p class="announcement-message">${escapeHtml(item.message)}</p>
      </article>
    `;
  }

  function renderAnnouncements(items) {
    if (!items.length) {
      elements.list.innerHTML = `
        <div class="empty-state">
          Ainda não há avisos publicados.<br>
          Publique um aviso como professor para iniciar a demonstração.
        </div>
      `;
      updateStatus(0);
      return;
    }

    elements.list.innerHTML = items.map(createAnnouncementMarkup).join("");
    updateStatus(items.length);
  }

  function readLocalAnnouncements() {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) return [];

    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  function writeLocalAnnouncements(items) {
    localStorage.setItem(localStorageKey, JSON.stringify(items));
  }

  async function loadAnnouncements() {
    try {
      if (mode === "cloud") {
        const { data, error } = await client
          .from("announcements")
          .select("id, title, message, audience, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;
        renderAnnouncements(data || []);
        return;
      }

      renderAnnouncements(readLocalAnnouncements());
    } catch (error) {
      setFeedback(`Falha ao carregar avisos: ${error.message}`, "error");
    }
  }

  async function publishAnnouncement(payload) {
    if (mode === "cloud") {
      const { error } = await client.from("announcements").insert(payload);
      if (error) throw error;
      return;
    }

    const items = readLocalAnnouncements();
    items.unshift({
      id: Date.now(),
      created_at: new Date().toISOString(),
      ...payload
    });
    writeLocalAnnouncements(items);
  }

  async function clearAnnouncements() {
    if (mode === "cloud") {
      const { error } = await client.from("announcements").delete().not("id", "is", null);
      if (error) throw error;
      return;
    }

    writeLocalAnnouncements([]);
  }

  function renderGithubIntegration(data) {
    elements.githubIntegration.innerHTML = `
      <dl class="integration-box">
        <dt>Repositório</dt>
        <dd>${escapeHtml(data.full_name)}</dd>
      </dl>
      <dl class="integration-box">
        <dt>Última atualização</dt>
        <dd>${formatDate(data.updated_at)}</dd>
      </dl>
      <dl class="integration-box">
        <dt>Visibilidade</dt>
        <dd>${data.private ? "Privado" : "Público"}</dd>
      </dl>
      <dl class="integration-box">
        <dt>Linguagem principal</dt>
        <dd>${escapeHtml(data.language || "Não identificada")}</dd>
      </dl>
    `;
  }

  function renderGithubIntegrationError(message) {
    elements.githubIntegration.innerHTML = `
      <div class="empty-state">
        Não foi possível carregar os dados do GitHub agora.<br>
        Detalhe: ${escapeHtml(message)}
      </div>
    `;
  }

  async function loadGithubIntegration() {
    try {
      const response = await fetch(`https://api.github.com/repos/${getGithubRepoPath()}`);
      if (!response.ok) {
        throw new Error(`GitHub respondeu com status ${response.status}`);
      }

      const data = await response.json();
      renderGithubIntegration(data);
    } catch (error) {
      renderGithubIntegrationError(error.message);
    }
  }

  function renderDogError(message) {
    elements.dogIntegration.innerHTML = `
      <div class="empty-state">
        Não foi possível carregar a experiência interativa de cães.<br>
        Detalhe: ${escapeHtml(message)}
      </div>
    `;
  }

  async function loadDogBreeds() {
    try {
      const response = await fetch("https://dog.ceo/api/breeds/list/all");
      if (!response.ok) {
        throw new Error(`A lista de raças respondeu com status ${response.status}`);
      }

      const data = await response.json();
      dogBreeds = Object.keys(data.message || {}).sort();
      const options = [
        '<option value="random">Qualquer raça</option>',
        ...dogBreeds.map((breed) => `<option value="${breed}">${normalizeLabel(breed)}</option>`)
      ];

      elements.dogBreedSelect.innerHTML = options.join("");

      if (dogBreeds.includes(config.defaultDogBreed)) {
        elements.dogBreedSelect.value = config.defaultDogBreed;
      }
    } catch (error) {
      renderDogError(error.message);
    }
  }

  function createDogSummary(breed) {
    if (breed === "random") {
      return "Modo surpresa ativado: a aplicação busca uma imagem aleatória para mostrar como uma integração pode entregar conteúdo novo a cada clique.";
    }

    return `A aplicação buscou uma imagem da raça ${normalizeLabel(breed)} em tempo real. Isso ajuda a demonstrar que um sistema pode incorporar serviços externos sem armazenar tudo localmente.`;
  }

  function renderDogCard(imageUrl, breed) {
    const selectedBreed = breed === "random" ? "Qualquer raça" : normalizeLabel(breed);
    const endpointUsed =
      breed === "random"
        ? "https://dog.ceo/api/breeds/image/random"
        : `https://dog.ceo/api/breed/${breed}/images/random`;

    elements.dogIntegration.innerHTML = `
      <div class="feature-panel">
        <figure class="feature-visual">
          <img class="feature-image" src="${imageUrl}" alt="Imagem de um cão da API pública">
          <figcaption class="feature-caption">
            Conteúdo obtido dinamicamente de uma API pública.
          </figcaption>
        </figure>
        <div class="feature-details">
          <h3 class="feature-title">Resultado da integração</h3>
          <p class="feature-summary">${escapeHtml(createDogSummary(breed))}</p>
          <dl class="stats-grid">
            <div class="stat-card">
              <dt>Raça solicitada</dt>
              <dd>${escapeHtml(selectedBreed)}</dd>
            </div>
            <div class="stat-card">
              <dt>Tipo de consumo</dt>
              <dd>Consulta HTTP em tempo real</dd>
            </div>
            <div class="stat-card">
              <dt>Endpoint utilizado</dt>
              <dd>${escapeHtml(endpointUsed)}</dd>
            </div>
          </dl>
        </div>
      </div>
    `;
  }

  async function loadDogImage(breed) {
    try {
      elements.dogIntegration.innerHTML = '<p class="integration-loading">Buscando imagem na API pública...</p>';

      const endpoint =
        breed === "random"
          ? "https://dog.ceo/api/breeds/image/random"
          : `https://dog.ceo/api/breed/${breed}/images/random`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`A API de cães respondeu com status ${response.status}`);
      }

      const data = await response.json();
      renderDogCard(data.message, breed);
    } catch (error) {
      renderDogError(error.message);
    }
  }

  function renderPokemonError(message) {
    elements.pokemonIntegration.innerHTML = `
      <div class="empty-state">
        Não foi possível carregar a experiência de Pokémon.<br>
        Detalhe: ${escapeHtml(message)}
      </div>
    `;
  }

  async function loadPokemonList() {
    try {
      const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=151");
      if (!response.ok) {
        throw new Error(`A PokéAPI respondeu com status ${response.status}`);
      }

      const data = await response.json();
      pokemonList = (data.results || []).map((item) => item.name);

      elements.pokemonSelect.innerHTML = pokemonList
        .map((name) => `<option value="${name}">${normalizeLabel(name)}</option>`)
        .join("");

      if (pokemonList.includes(config.defaultPokemon)) {
        elements.pokemonSelect.value = config.defaultPokemon;
      }
    } catch (error) {
      renderPokemonError(error.message);
    }
  }

  function renderPokemonCard(data) {
    const types = (data.types || []).map((item) => normalizeLabel(item.type.name)).join(", ");
    const sprite =
      data.sprites.other["official-artwork"].front_default ||
      data.sprites.front_default ||
      "";

    elements.pokemonIntegration.innerHTML = `
      <div class="feature-panel">
        <figure class="feature-visual">
          <img class="feature-image" src="${sprite}" alt="Arte oficial do Pokémon ${escapeHtml(data.name)}">
          <figcaption class="feature-caption">
            Dados e imagem obtidos da PokéAPI.
          </figcaption>
        </figure>
        <div class="feature-details">
          <h3 class="feature-title">${escapeHtml(normalizeLabel(data.name))}</h3>
          <p class="feature-summary">
            A aplicação consultou um catálogo público especializado e montou um pequeno painel com nome, tipo e atributos do Pokémon.
          </p>
          <dl class="stats-grid">
            <div class="stat-card">
              <dt>Tipos</dt>
              <dd>${escapeHtml(types)}</dd>
            </div>
            <div class="stat-card">
              <dt>Altura</dt>
              <dd>${data.height}</dd>
            </div>
            <div class="stat-card">
              <dt>Peso</dt>
              <dd>${data.weight}</dd>
            </div>
            <div class="stat-card">
              <dt>Experiência base</dt>
              <dd>${data.base_experience || "N/D"}</dd>
            </div>
          </dl>
        </div>
      </div>
    `;
  }

  async function loadPokemon(name) {
    try {
      elements.pokemonIntegration.innerHTML = '<p class="integration-loading">Buscando dados da PokéAPI...</p>';

      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
      if (!response.ok) {
        throw new Error(`A PokéAPI respondeu com status ${response.status}`);
      }

      const data = await response.json();
      renderPokemonCard(data);
    } catch (error) {
      renderPokemonError(error.message);
    }
  }

  function renderMoviesError(message) {
    elements.moviesIntegration.innerHTML = `
      <div class="empty-state">
        Não foi possível carregar os filmes.<br>
        Detalhe: ${escapeHtml(message)}
      </div>
    `;
  }

  function getTmdbEndpoint(category) {
    const routes = {
      trending: "https://api.themoviedb.org/3/trending/movie/week?language=pt-BR",
      popular: "https://api.themoviedb.org/3/movie/popular?language=pt-BR",
      top_rated: "https://api.themoviedb.org/3/movie/top_rated?language=pt-BR"
    };

    return routes[category] || routes.trending;
  }

  function renderMovies(movies) {
    if (!movies.length) {
      renderMoviesError("Nenhum filme foi retornado pela API.");
      return;
    }

    elements.moviesIntegration.innerHTML = movies
      .map((movie) => {
        const poster = movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : "";

        return `
          <article class="movie-card">
            ${poster ? `<img class="movie-poster" src="${poster}" alt="Pôster do filme ${escapeHtml(movie.title)}">` : ""}
            <h3 class="movie-title">${escapeHtml(movie.title)}</h3>
            <p class="movie-meta">Nota: ${movie.vote_average} | Lançamento: ${escapeHtml(movie.release_date || "N/D")}</p>
            <p class="movie-overview">${escapeHtml((movie.overview || "Sem sinopse disponível.").slice(0, 180))}</p>
          </article>
        `;
      })
      .join("");
  }

  async function loadMovies(category) {
    if (!config.tmdbReadAccessToken) {
      renderMoviesError("Preencha tmdbReadAccessToken em config.js para usar a API do TMDB.");
      return;
    }

    try {
      elements.moviesIntegration.innerHTML = '<p class="integration-loading">Buscando filmes no TMDB...</p>';

      const response = await fetch(getTmdbEndpoint(category), {
        headers: {
          Authorization: `Bearer ${config.tmdbReadAccessToken}`,
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`O TMDB respondeu com status ${response.status}`);
      }

      const data = await response.json();
      renderMovies((data.results || []).slice(0, 4));
    } catch (error) {
      renderMoviesError(error.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (elements.pin.value !== professorPin) {
      setFeedback("PIN inválido. Use o PIN do professor para publicar.", "error");
      return;
    }

    const payload = {
      title: elements.title.value.trim(),
      message: elements.message.value.trim(),
      audience: elements.audience.value
    };

    if (!payload.title || !payload.message) {
      setFeedback("Preencha o título e a mensagem antes de publicar.", "error");
      return;
    }

    try {
      await publishAnnouncement(payload);
      elements.form.reset();
      setFeedback("Aviso publicado com sucesso.", "success");
      await loadAnnouncements();
    } catch (error) {
      setFeedback(`Falha ao publicar: ${error.message}`, "error");
    }
  }

  function handleSeed() {
    elements.title.value = sampleAnnouncement.title;
    elements.message.value = sampleAnnouncement.message;
    elements.audience.value = sampleAnnouncement.audience;
    elements.pin.value = professorPin;
    setFeedback("Exemplo carregado no formulário. Clique em publicar.", "success");
  }

  async function handleClear() {
    if (elements.pin.value !== professorPin) {
      setFeedback("Informe o PIN do professor para limpar os avisos.", "error");
      return;
    }

    try {
      await clearAnnouncements();
      setFeedback("Avisos removidos.", "success");
      await loadAnnouncements();
    } catch (error) {
      setFeedback(`Falha ao limpar: ${error.message}`, "error");
    }
  }

  async function toggleSection(sectionName, label) {
    if (!canUseTeacherControls()) {
      return;
    }

    try {
      sectionVisibility[sectionName] = !sectionVisibility[sectionName];
      await savePresentationState();
      applySectionVisibility();
      setTeacherFeedback(`Seção de ${label} ${sectionVisibility[sectionName] ? "mostrada" : "ocultada"} com sucesso.`, "success");
    } catch (error) {
      setTeacherFeedback(`Falha ao atualizar visibilidade: ${error.message}`, "error");
    }
  }

  function startAnnouncementsPolling() {
    window.setInterval(loadAnnouncements, refreshIntervalMs);
  }

  function startVisibilityPolling() {
    window.setInterval(async function () {
      try {
        await loadPresentationState();
      } catch (error) {
        // Evita ruído excessivo na interface do aluno se a sincronização falhar momentaneamente.
      }
    }, visibilityPollMs);
  }

  function initCloudClient() {
    if (!isCloudModeReady()) return;

    mode = "cloud";
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  async function bootstrap() {
    initCloudClient();
    setModeUi();

    try {
      await loadPresentationState();
    } catch (error) {
      setTeacherFeedback(`Falha ao carregar visibilidade compartilhada: ${error.message}`, "error");
      sectionVisibility = readLocalVisibilityState();
      applySectionVisibility();
    }

    await loadAnnouncements();
    await Promise.all([loadGithubIntegration(), loadDogBreeds(), loadPokemonList()]);
    await Promise.all([
      loadDogImage(elements.dogBreedSelect.value || "random"),
      loadPokemon(elements.pokemonSelect.value || config.defaultPokemon || "pikachu"),
      loadMovies(elements.movieCategorySelect.value || "trending")
    ]);

    startAnnouncementsPolling();
    startVisibilityPolling();

    elements.form.addEventListener("submit", handleSubmit);
    elements.refreshButton.addEventListener("click", loadAnnouncements);
    elements.seedButton.addEventListener("click", handleSeed);
    elements.clearButton.addEventListener("click", handleClear);

    elements.toggleGithubButton.addEventListener("click", function () {
      toggleSection("github", "GitHub");
    });
    elements.toggleDogButton.addEventListener("click", function () {
      toggleSection("dogs", "cães");
    });
    elements.togglePokemonButton.addEventListener("click", function () {
      toggleSection("pokemon", "Pokémon");
    });
    elements.toggleMoviesButton.addEventListener("click", function () {
      toggleSection("movies", "filmes");
    });

    elements.dogFetchButton.addEventListener("click", function () {
      loadDogImage(elements.dogBreedSelect.value);
    });
    elements.dogSurpriseButton.addEventListener("click", function () {
      elements.dogBreedSelect.value = "random";
      loadDogImage("random");
    });
    elements.pokemonFetchButton.addEventListener("click", function () {
      loadPokemon(elements.pokemonSelect.value);
    });
    elements.pokemonRandomButton.addEventListener("click", function () {
      if (!pokemonList.length) return;
      const randomName = pokemonList[Math.floor(Math.random() * pokemonList.length)];
      elements.pokemonSelect.value = randomName;
      loadPokemon(randomName);
    });
    elements.movieFetchButton.addEventListener("click", function () {
      loadMovies(elements.movieCategorySelect.value);
    });
  }

  bootstrap();
})();
