(function () {
  // Lê as configurações compartilhadas do projeto.
  const config = window.APP_CONFIG || {};
  const professorPin = String(config.professorPin || "1234");
  const localStorageKey = "saas-demo-announcements";
  const refreshIntervalMs = 15000;

  // Guarda referências aos elementos da página para evitar buscas repetidas no DOM.
  const elements = {
    form: document.getElementById("announcementForm"),
    title: document.getElementById("title"),
    message: document.getElementById("message"),
    audience: document.getElementById("audience"),
    pin: document.getElementById("pin"),
    feedback: document.getElementById("formFeedback"),
    list: document.getElementById("announcementList"),
    count: document.getElementById("announcementCount"),
    lastSync: document.getElementById("lastSync"),
    modeBadge: document.getElementById("modeBadge"),
    modeDescription: document.getElementById("modeDescription"),
    refreshButton: document.getElementById("refreshButton"),
    seedButton: document.getElementById("seedButton"),
    clearButton: document.getElementById("clearButton")
  };

  const sampleAnnouncement = {
    title: "Apresentações remarcadas",
    message: "O grupo Azure apresentará primeiro e o grupo AWS ficou para o segundo bloco da aula.",
    audience: "Todos"
  };

  let client = null;
  let mode = "local";

  function isCloudModeReady() {
    // Só ativa o modo SaaS real quando há credenciais válidas do Supabase.
    return Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  }

  function setModeUi() {
    if (mode === "cloud") {
      elements.modeBadge.textContent = "Modo nuvem ativo";
      elements.modeBadge.classList.add("cloud");
      elements.modeDescription.textContent =
        "Os avisos estão sendo lidos e gravados em um banco na nuvem. Abra em outro dispositivo para demonstrar centralização.";
      return;
    }

    elements.modeBadge.textContent = "Modo local de demonstração";
    elements.modeBadge.classList.remove("cloud");
    elements.modeDescription.textContent =
      "Sem configuração de nuvem. O sistema funciona localmente para você testar a interface e depois migrar para o modo SaaS.";
  }

  function setFeedback(message, type) {
    // Exibe mensagens de orientação ou erro para o usuário.
    elements.feedback.textContent = message;
    elements.feedback.className = "feedback";
    if (type) {
      elements.feedback.classList.add(type);
    }
  }

  function formatDate(isoDate) {
    // Formata datas de forma amigável para pt-BR.
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(isoDate));
  }

  function updateStatus(count) {
    elements.count.textContent = String(count);
    elements.lastSync.textContent = formatDate(new Date().toISOString());
  }

  function createAnnouncementMarkup(item) {
    // Monta visualmente cada aviso que aparecerá para os alunos.
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
          Publique um aviso como professor para demonstrar o funcionamento do SaaS.
        </div>
      `;
      updateStatus(0);
      return;
    }

    elements.list.innerHTML = items.map(createAnnouncementMarkup).join("");
    updateStatus(items.length);
  }

  function escapeHtml(value) {
    // Protege a página contra HTML digitado pelo usuário dentro dos avisos.
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function readLocalAnnouncements() {
    // No modo local, os dados ficam salvos apenas neste navegador.
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
    // Carrega os dados da nuvem ou do armazenamento local, conforme o modo atual.
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
    // Publica o aviso no Supabase ou salva localmente, dependendo do modo.
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
    // Limpa os dados para reiniciar a demonstração rapidamente.
    if (mode === "cloud") {
      const { error } = await client.from("announcements").delete().not("id", "is", null);
      if (error) throw error;
      return;
    }

    writeLocalAnnouncements([]);
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

  async function handleSeed() {
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

  function startPolling() {
    // Atualiza a lista periodicamente para reforçar a ideia de sincronização.
    window.setInterval(loadAnnouncements, refreshIntervalMs);
  }

  function initCloudClient() {
    if (!isCloudModeReady()) return;

    mode = "cloud";
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  function bootstrap() {
    // Ponto de entrada da aplicação: ativa o modo correto e registra eventos.
    initCloudClient();
    setModeUi();
    loadAnnouncements();
    startPolling();

    elements.form.addEventListener("submit", handleSubmit);
    elements.refreshButton.addEventListener("click", loadAnnouncements);
    elements.seedButton.addEventListener("click", handleSeed);
    elements.clearButton.addEventListener("click", handleClear);
  }

  bootstrap();
})();
