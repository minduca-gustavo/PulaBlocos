// ============================================================
// background.js
// Funções de fetch, armazenamento e navegação da extensão "Pula
// Blocos". Roda como service worker (manifest.json → background),
// e também pode ser incluído em popup.html — são só funções
// utilitárias, não fazem nada sozinhas ao carregar.
//
// Sobre o erro de CORS do fetch que você mandou:
//   O problema não é falta de header — é que o fetch estava rodando
//   dentro da própria página (grancursosonline.com.br), sujeito às
//   regras normais de CORS do navegador. Rodando a partir da extensão
//   (aqui, no service worker), com "host_permissions" declarado no
//   manifest.json para *.grancursosonline.com.br, o Chrome/Firefox
//   isenta esses domínios do bloqueio de CORS — a extensão pode
//   buscar diretamente. Não dá pra fixar manualmente headers como
//   User-Agent, Referer ou Sec-Fetch-* (o navegador bloqueia isso por
//   segurança), mas eles não fazem falta: o navegador já envia a
//   versão correta sozinho.
//
// Sobre o token Authorization do seu exemplo:
//   Ele expira (dá pra ver o campo "exp" dentro do JWT). Não fixei
//   nenhum token aqui — o blocoFetch manda "credentials: include",
//   então os cookies de sessão do grancursosonline.com.br já viajam
//   junto automaticamente (não dependem do token). Se um endpoint
//   específico exigir Bearer, passe em opcoes.headers na hora da
//   chamada.
// ============================================================


// ── armazenamento (chrome.storage.local) ────────────────────
//
// armazenar({ chave: valor, ... })

async function armazenar(objeto) {
    await chrome.storage.local.set(objeto)
    return true
}

// obterArmazenamento(chave)          → valor único
// obterArmazenamento([chave1, ...])  → { chave1: valor1, ... }

async function obterArmazenamento(chave) {
    const ehArray = Array.isArray(chave)
    const resultado = await chrome.storage.local.get(ehArray ? chave : [chave])
    return ehArray ? resultado : resultado[chave]
}

async function removerArmazenamento(chave) {
    await chrome.storage.local.remove(chave)
    return true
}


// ── indexedDB (para dados maiores que o storage.local aguenta) ──
//
// Um único object store de chave/valor, bem simples.
//
// indexed('minha-chave', { qualquer: 'coisa' })
// obterIndexed('minha-chave')  → o valor salvo
// obterIndexed()               → array com { chave, valor, atualizadoEm } de tudo

const INDEXED_DB_NOME  = 'PulaBlocosDB'
const INDEXED_DB_VERSAO = 1
const INDEXED_STORE     = 'blocos'

function _indexedAbrir() {
    return new Promise((resolve, reject) => {
        const pedido = indexedDB.open(INDEXED_DB_NOME, INDEXED_DB_VERSAO)
        pedido.onupgradeneeded = () => {
            const db = pedido.result
            if (!db.objectStoreNames.contains(INDEXED_STORE)) {
                db.createObjectStore(INDEXED_STORE, { keyPath: 'chave' })
            }
        }
        pedido.onsuccess = () => resolve(pedido.result)
        pedido.onerror   = () => reject(pedido.error)
    })
}

async function indexed(chave, valor) {
    const db = await _indexedAbrir()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(INDEXED_STORE, 'readwrite')
        tx.objectStore(INDEXED_STORE).put({ chave, valor, atualizadoEm: Date.now() })
        tx.oncomplete = () => resolve(true)
        tx.onerror    = () => reject(tx.error)
    })
}

async function obterIndexed(chave) {
    const db = await _indexedAbrir()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(INDEXED_STORE, 'readonly')
        const store = tx.objectStore(INDEXED_STORE)
        if (chave) {
            const pedido = store.get(chave)
            pedido.onsuccess = () => resolve(pedido.result ? pedido.result.valor : undefined)
            pedido.onerror   = () => reject(pedido.error)
        } else {
            const pedido = store.getAll()
            pedido.onsuccess = () => resolve(pedido.result)
            pedido.onerror   = () => reject(pedido.error)
        }
    })
}

async function removerIndexed(chave) {
    const db = await _indexedAbrir()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(INDEXED_STORE, 'readwrite')
        tx.objectStore(INDEXED_STORE).delete(chave)
        tx.oncomplete = () => resolve(true)
        tx.onerror    = () => reject(tx.error)
    })
}


// ── captura automática do token Authorization ───────────────
//
// Várias APIs do grancursosonline.com.br (como a rota-api) exigem
// o header Authorization com um JWT — cookie de sessão não basta,
// e esse token expira. Em vez de fixar ele no código, escutamos as
// próprias requisições que o site faz enquanto você navega nele e
// guardamos o token mais recente. O blocoFetch usa esse token
// sozinho, então ele se renova a cada vez que o site troca o dele.

const CHAVE_TOKEN_GRAN = 'blocosTokenGranAuthorization'

function _capturarTokenAutorizacao(detalhes) {
    const cabecalho = detalhes.requestHeaders?.find(
        (h) => h.name.toLowerCase() === 'authorization'
    )
    if (cabecalho?.value) {
        console.log('[Pula Blocos] token capturado de', detalhes.url)
        armazenar({ [CHAVE_TOKEN_GRAN]: cabecalho.value }).catch((erro) =>
            console.warn('[Pula Blocos] falha ao salvar token capturado:', erro)
        )
    }
}

// 'extraHeaders' é exigido pelo Chrome pra revelar o Authorization aqui,
// mas o Firefox não reconhece essa opção e quebra o registro do listener
// se ela for passada. Tenta do jeito do Chrome primeiro, cai pro jeito
// do Firefox se der erro.
if (typeof chrome !== 'undefined' && chrome.webRequest && chrome.webRequest.onSendHeaders) {
    try {
        chrome.webRequest.onSendHeaders.addListener(
            _capturarTokenAutorizacao,
            { urls: ['https://*.grancursosonline.com.br/*'] },
            ['requestHeaders', 'extraHeaders']
        )
        console.log('[Pula Blocos] captura de token registrada (modo Chrome)')
    } catch (erroChrome) {
        try {
            chrome.webRequest.onSendHeaders.addListener(
                _capturarTokenAutorizacao,
                { urls: ['https://*.grancursosonline.com.br/*'] },
                ['requestHeaders']
            )
            console.log('[Pula Blocos] captura de token registrada (modo Firefox)')
        } catch (erroFirefox) {
            console.error('[Pula Blocos] não foi possível registrar a captura de token:', erroFirefox)
        }
    }
}


// ── blocoFetch ────────────────────────────────────────────────
//
// Fetch padrão da extensão. Sempre manda cookies de sessão
// (credentials: 'include') e, se a URL for do grancursosonline.com.br
// e houver um token capturado, manda o Authorization também — sem
// precisar passar nada manualmente. Para qualquer outro domínio (ex.:
// GitHub), o token automático não é anexado, só o que vier em
// opcoes.headers. Detecta JSON x texto sozinho.
//
// blocoFetch(url)
// blocoFetch(url, { headers: { Authorization: 'Bearer ...' } })  // força um token específico
// blocoFetch(url, { method: 'POST', body: JSON.stringify({...}) })

function _ehDominioGranCursos(url) {
    try {
        return new URL(url).hostname.endsWith('grancursosonline.com.br')
    } catch {
        return false
    }
}

async function blocoFetch(url, opcoes = {}) {
    const { headers: headersExtras, credentials: credenciaisForcadas, ...resto } = opcoes
    const ehGranCursos = _ehDominioGranCursos(url)
    const tokenCapturado = ehGranCursos ? await obterArmazenamento(CHAVE_TOKEN_GRAN) : null

    try {
        const resposta = await fetch(url, {
            // 'include' manda cookies de sessão — só faz sentido (e só funciona
            // sem quebrar CORS) no próprio domínio do Gran Cursos. Em domínios
            // com CORS aberto por wildcard (ex.: GitHub Pages), mandar
            // credentials aqui faz o navegador bloquear a resposta, mesmo a
            // URL sendo pública.
            credentials: credenciaisForcadas ?? (ehGranCursos ? 'include' : 'omit'),
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                ...(tokenCapturado ? { Authorization: tokenCapturado } : {}),
                ...headersExtras,
            },
            ...resto,
        })

        if (!resposta.ok) {
            console.warn('[Pula Blocos] blocoFetch resposta não-ok:', resposta.status, url)
        }

        const tipo = resposta.headers.get('content-type') || ''
        const corpo = tipo.includes('application/json') ? await resposta.json() : await resposta.text()

        return { ok: resposta.ok, status: resposta.status, corpo }
    } catch (erro) {
        console.error('[Pula Blocos] blocoFetch falhou:', url, erro)
        throw erro
    }
}


// ── navegar ──────────────────────────────────────────────────
//
// navegar(url)                       → abre em nova aba
// navegar(url, { novaAba: false })   → navega na aba ativa

async function navegar(url, opcoes = {}) {
    const { novaAba = true } = opcoes
    if (novaAba) {
        return await chrome.tabs.create({ url })
    }
    const [abaAtiva] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (abaAtiva) return await chrome.tabs.update(abaAtiva.id, { url })
    return await chrome.tabs.create({ url })
}


// ── service worker: mensagens do popup/content-script ─────────
//
// Permite chamar essas funções a partir de um content script
// (que não tem acesso direto a elas) via chrome.runtime.sendMessage.
//
//   chrome.runtime.sendMessage({ acao: 'blocoFetch', url, opcoes })
//   chrome.runtime.sendMessage({ acao: 'armazenar', dados: {...} })
//   chrome.runtime.sendMessage({ acao: 'obterArmazenamento', chave })
//   chrome.runtime.sendMessage({ acao: 'navegar', url, opcoes })

const FUNCOES_DISPONIVEIS = {
    blocoFetch: (msg) => blocoFetch(msg.url, msg.opcoes),
    armazenar: (msg) => armazenar(msg.dados),
    obterArmazenamento: (msg) => obterArmazenamento(msg.chave),
    indexed: (msg) => indexed(msg.chave, msg.valor),
    obterIndexed: (msg) => obterIndexed(msg.chave),
    navegar: (msg) => navegar(msg.url, msg.opcoes),
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
        const funcao = FUNCOES_DISPONIVEIS[mensagem?.acao]
        if (!funcao) return false

        funcao(mensagem)
            .then((resultado) => responder({ ok: true, resultado }))
            .catch((erro) => responder({ ok: false, erro: String(erro) }))

        return true // mantém o canal aberto para a resposta assíncrona
    })
}