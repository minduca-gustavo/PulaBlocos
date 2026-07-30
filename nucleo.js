// ============================================================
// nucleo.js
// Funções utilitárias seguras pra usar dentro de um CONTENT SCRIPT
// (rodando na página, ex.: grancursosonline.com.br). Diferente de
// background.js, que só existe no service worker / popup.
//
// Inclua este arquivo (e elementos.js) em "content_scripts" no
// manifest.json. Não inclua background.js lá — ele tem blocoFetch,
// que se chamado de dentro da página volta a esbarrar em CORS
// (é exatamente o problema que host_permissions resolve, mas só
// quando o fetch sai do contexto da extensão).
//
// armazenar / obterArmazenamento / indexed / obterIndexed:
//   Rodam direto aqui, sem passar pelo background — chrome.storage
//   e indexedDB funcionam normalmente dentro de um content script.
//
// navegar / blocoFetch:
//   Não têm como rodar aqui (chrome.tabs não existe em content
//   script; fetch aqui não tem a isenção de CORS do
//   host_permissions). Este arquivo expõe versões com a MESMA
//   assinatura que pedem pro background.js fazer via sendMessage —
//   você chama igual, sem se preocupar com o "por baixo".
//
// ATENÇÃO — IndexedDB tem "dono" por origem:
//   O indexedDB aberto aqui (nucleo.js, dentro da página) pertence
//   à origem da PÁGINA (https://grancursosonline.com.br). O
//   indexedDB aberto pelo background.js pertence à origem da
//   EXTENSÃO (chrome-extension://... ou moz-extension://...). São
//   dois bancos diferentes, mesmo com o mesmo nome de store — não
//   se misturam. Se seu plano é espelhar tudo num único lugar,
//   prefira sempre chamar indexed/obterIndexed a partir daqui (do
//   content script), consistentemente, ou sempre do background via
//   mensagem — não os dois misturados.
// ============================================================


// ── armazenamento (chrome.storage.local) ────────────────────

async function armazenar(objeto) {
    await chrome.storage.local.set(objeto)
    return true
}

async function obterArmazenamento(chave) {
    const ehArray = Array.isArray(chave)
    const resultado = await chrome.storage.local.get(ehArray ? chave : [chave])
    return ehArray ? resultado : resultado[chave]
}

async function removerArmazenamento(chave) {
    await chrome.storage.local.remove(chave)
    return true
}


// ── indexedDB (mesmo esquema do background.js — ver aviso de origem acima) ──

const INDEXED_DB_NOME   = 'PulaBlocosDB'
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


// ── navegar / blocoFetch — pedem pro background.js via mensagem ──
//
// Mesma assinatura das versões "de verdade" do background.js.
// Chame igual, o desvio pra mensagem é transparente.

async function _pedirAoBackground(acao, dados) {
    const resposta = await chrome.runtime.sendMessage({ acao, ...dados })
    if (!resposta?.ok) throw new Error(resposta?.erro || `${acao} falhou`)
    return resposta.resultado
}

async function navegar(url, opcoes = {}) {
    return _pedirAoBackground('navegar', { url, opcoes })
}

async function blocoFetch(url, opcoes = {}) {
    return _pedirAoBackground('blocoFetch', { url, opcoes })
}
/*
async function salvarDados() {
    let dados = await obterArmazenamento('pulaBlocos')
    await navigator.clipboard.writeText(JSON.stringify(dados));
}
*/
async function salvarDados() {
    try {
        let dados = await obterArmazenamento('pulaBlocos')
        let json = JSON.stringify(dados, null, 2)
        let blob = new Blob([json], { type: 'application/json' })
        let url = URL.createObjectURL(blob)
 
        let dataAtual = new Date().toISOString().slice(0, 10) // AAAA-MM-DD
        let a = document.createElement('a')
        a.href = url
        a.download = `pula-blocos-backup-${dataAtual}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    } catch (erro) {
        console.error('[Pula Blocos] falha ao exportar backup:', erro)
        alert('Não deu pra gerar o backup: ' + erro.message, 'erro')
    }
}

async function carregarDados(arquivo) {
   
    try {
        const texto = await arquivo.text()
        const dados = JSON.parse(texto)

        if (typeof dados !== 'object' || dados === null || Array.isArray(dados)) {
            throw new Error('o arquivo não parece um backup válido')
        }

        await armazenar({pulaBlocos : dados})
        alert('Backup restaurado! Feche e abra o popup de novo pra ver tudo atualizado.', 'sucesso')
    } catch (erro) {
        console.error('[Pula Blocos] falha ao importar backup:', erro)
        alert('Arquivo inválido: ' + erro.message, 'erro')
    }
    
    
}


function normalizar(texto){
    return String(texto ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}