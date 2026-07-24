// ============================================================
// elementos.js
// Biblioteca de componentes visuais da extensão "Pula Blocos".
// Baseada no ui.js do Rota PJE, simplificada e com paleta própria.
//
// Paleta (azul tranquilo):
//   #2f6690  azul principal
//   #3a7ca5  azul secundário / hover
//   #16425b  azul escuro (texto, contraste)
//   #81c3d7  azul claro (destaque suave)
//   #d9dcd6  cinza-esverdeado claro (fundo)
//
// Convenção:
//   - Todo componente recebe um objeto de configuração.
//   - 'ancestral' é o id (string) do elemento pai, ou um seletor CSS.
//   - O elemento criado é inserido no ancestral automaticamente.
//   - Todo componente retorna o elemento raiz criado.
//   - Ids são obrigatórios para acesso posterior via
//     document.getElementById(id).
//
// Depende (opcionalmente) de armazenar()/obterArmazenamento(),
// definidas em background.js, para persistir posição da
// criaDivFlutuante. Se não estiverem carregadas, o componente
// funciona normalmente, só não lembra a posição entre usos.
// ============================================================


// ── Paleta e utilitários internos ─────────────────────────────

const UI_CORES = {
    azul:         '#2f6690',
    azulHover:    '#16425b',
    azulClaro:    '#81c3d7',
    azulClaroHover: '#6badc4',
    fundo:        '#d9dcd6',
    borda:        '#b9bdb5',
    texto:        '#16425b',
    suave:        '#3a7ca5',
    branco:       '#ffffff',
    erro:         '#b3435c',
    erroHover:    '#8f3149',
    sucesso:      '#3a7ca5',
}

const UI_FONTE = "'Segoe UI', system-ui, sans-serif"

function _ui_el(tag, estilos = {}) {
    const el = document.createElement(tag)
    Object.assign(el.style, estilos)
    return el
}

// Insere 'el' dentro do elemento com id 'ancestral'.
// Aceita id simples ('minha-div') ou seletor CSS ('[data-x="1"]').
// Se não encontrar, insere no body com aviso no console.
function _ui_inserir(el, ancestral) {
    if (!ancestral) {
        document.body.appendChild(el)
        return
    }
    const pai = ancestral.match(/^[a-zA-Z0-9_-]+$/)
        ? document.getElementById(ancestral)
        : document.querySelector(ancestral)
    if (!pai) {
        console.warn('[elementos.js] ancestral não encontrado:', ancestral)
        document.body.appendChild(el)
        return
    }
    pai.appendChild(el)
}

// 'primaria' | 'secundaria' | 'erro' | um hex customizado
function _ui_resolveCor(cor) {
    if (cor === 'secundaria') return { cor: UI_CORES.azulClaro, corHover: UI_CORES.azulClaroHover, texto: UI_CORES.texto }
    if (cor === 'erro')       return { cor: UI_CORES.erro,      corHover: UI_CORES.erroHover,      texto: UI_CORES.branco }
    if (cor === 'primaria' || !cor) return { cor: UI_CORES.azul, corHover: UI_CORES.azulHover, texto: UI_CORES.branco }
    return { cor: cor, corHover: _ui_escurecerHex(cor, 15), texto: UI_CORES.branco } // hex customizado
}

function _ui_escurecerHex(hex, porcentagem) {
    hex = hex.replace('#', '')
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
    const num   = parseInt(hex, 16)
    const fator = 1 - porcentagem / 100
    const r = Math.max(0, Math.min(255, Math.floor(((num >> 16) & 0xff) * fator)))
    const g = Math.max(0, Math.min(255, Math.floor(((num >> 8)  & 0xff) * fator)))
    const b = Math.max(0, Math.min(255, Math.floor(( num        & 0xff) * fator)))
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function _ui_estiloBotao(cor, corHover, corTexto) {
    return {
        display:      'block',
        width:        '100%',
        background:   cor,
        color:        corTexto,
        border:       'none',
        borderRadius: '6px',
        padding:      '8px 12px',
        fontSize:     '12px',
        fontWeight:   '700',
        fontFamily:   UI_FONTE,
        cursor:       'pointer',
        textAlign:    'center',
        transition:   'background 0.15s',
        boxSizing:    'border-box',
    }
}

function _ui_hoverBotao(btn, cor, corHover) {
    btn.addEventListener('mouseenter', () => btn.style.background = corHover)
    btn.addEventListener('mouseleave', () => btn.style.background = cor)
}


// ── criaDiv ───────────────────────────────────────────────────
//
// Container genérico em coluna. Usado para agrupar componentes.
//
// criaDiv({ id, ancestral, gap })

function criaDiv({ id, ancestral, gap = '6px' }) {
    const el = _ui_el('div', {
        display:       'flex',
        flexDirection: 'column',
        gap:           gap,
        marginBottom:  '8px',
    })
    el.id = id
    _ui_inserir(el, ancestral)
    return el
}


// ── criaDivFlutuante ──────────────────────────────────────────
//
// Container flutuante e arrastável (barra de título com
// recolher/fechar). Posição salva via armazenar/obterArmazenamento,
// se disponíveis.
//
// criaDivFlutuante({ id, titulo, largura, ancestral })

async function criaDivFlutuante({ id, titulo = '', largura = '280px', ancestral }) {
    const CHAVE   = 'ui_flutuante_pos_' + id
    const POS_PAD = 16
    let posicao   = { top: POS_PAD, left: POS_PAD }

    if (typeof obterArmazenamento === 'function') {
        try {
            const salvo = await obterArmazenamento(CHAVE)
            if (salvo && typeof salvo.top === 'number') {
                const maxTop  = Math.max(0, window.innerHeight - 120)
                const maxLeft = Math.max(0, window.innerWidth  - 120)
                posicao = {
                    top:  Math.min(Math.max(0, salvo.top),  maxTop),
                    left: Math.min(Math.max(0, salvo.left), maxLeft),
                }
            }
        } catch (erro) {
            console.warn('[elementos.js] não foi possível recuperar posição salva:', erro)
        }
    }

    const wrapper = _ui_el('div', {
        position:      'fixed',
        top:           posicao.top  + 'px',
        left:          posicao.left + 'px',
        width:         largura,
        background:    UI_CORES.branco,
        border:        '1px solid ' + UI_CORES.borda,
        borderRadius:  '8px',
        boxShadow:     '0 4px 16px rgba(22,66,91,0.20)',
        zIndex:        '999999',
        display:       'flex',
        flexDirection: 'column',
        fontFamily:    UI_FONTE,
        userSelect:    'none',
        minWidth:      '180px',
    })
    wrapper.id = id

    const barra = _ui_el('div', {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        background:     UI_CORES.azul,
        color:          UI_CORES.branco,
        borderRadius:   '7px 7px 0 0',
        padding:        '6px 10px',
        cursor:         'grab',
        fontSize:       '12px',
        fontWeight:     '700',
        flexShrink:     '0',
    })

    const barraTexto = _ui_el('span', {})
    barraTexto.textContent = titulo

    const barraBotoes = _ui_el('div', { display: 'flex', alignItems: 'center', gap: '2px', flexShrink: '0' })

    function _criaBotaoBarra(texto, tituloBotao) {
        const botao = _ui_el('button', {
            background: 'transparent', border: 'none', color: UI_CORES.branco,
            cursor: 'pointer', fontSize: '13px', lineHeight: '1',
            padding: '2px 5px', borderRadius: '4px',
        })
        botao.type = 'button'
        botao.textContent = texto
        botao.title = tituloBotao
        botao.addEventListener('mouseenter', () => botao.style.background = 'rgba(255,255,255,0.2)')
        botao.addEventListener('mouseleave', () => botao.style.background = 'transparent')
        return botao
    }

    const botaoRecolher = _criaBotaoBarra('─', 'Recolher')
    const botaoFechar   = _criaBotaoBarra('✕', 'Fechar')
    barraBotoes.appendChild(botaoRecolher)
    barraBotoes.appendChild(botaoFechar)
    barra.appendChild(barraTexto)
    barra.appendChild(barraBotoes)
    wrapper.appendChild(barra)

    const corpo = _ui_el('div', {
        display: 'flex', flexDirection: 'column', gap: '6px',
        padding: '8px 10px 10px 10px', overflowY: 'auto', maxHeight: '80vh',
    })
    corpo.id = id + '-corpo'
    wrapper.appendChild(corpo)

    let recolhido = false
    botaoRecolher.addEventListener('click', (e) => {
        e.stopPropagation()
        recolhido = !recolhido
        corpo.style.display = recolhido ? 'none' : 'flex'
        botaoRecolher.textContent = recolhido ? '▢' : '─'
        botaoRecolher.title       = recolhido ? 'Expandir' : 'Recolher'
    })

    botaoFechar.addEventListener('click', (e) => {
        e.stopPropagation()
        wrapper.remove()
    })

    let arrastando = false
    let origemX, origemY, inicioTop, inicioLeft

    barra.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return
        arrastando = true
        origemX    = e.clientX
        origemY    = e.clientY
        inicioTop  = parseInt(wrapper.style.top)  || 0
        inicioLeft = parseInt(wrapper.style.left) || 0
        barra.style.cursor = 'grabbing'
        e.preventDefault()
    })

    document.addEventListener('mousemove', (e) => {
        if (!arrastando) return
        wrapper.style.top  = (inicioTop  + (e.clientY - origemY)) + 'px'
        wrapper.style.left = (inicioLeft + (e.clientX - origemX)) + 'px'
    })

    document.addEventListener('mouseup', async () => {
        if (!arrastando) return
        arrastando = false
        barra.style.cursor = 'grab'
        if (typeof armazenar === 'function') {
            const top  = parseInt(wrapper.style.top)
            const left = parseInt(wrapper.style.left)
            try { await armazenar({ [CHAVE]: { top, left } }) } catch (erro) { console.warn('[elementos.js] falha ao salvar posição:', erro) }
        }
    })

    _ui_inserir(wrapper, ancestral)
    return wrapper
}


// ── criaTitulo / criaSubTitulo / criaTexto ─────────────────────

function criaTitulo({ id, texto, ancestral }) {
    const el = _ui_el('div', {
        fontSize: '14px', fontWeight: '700', color: UI_CORES.texto,
        borderLeft: '3px solid ' + UI_CORES.azul, paddingLeft: '8px',
        marginBottom: '4px', fontFamily: UI_FONTE,
    })
    el.id = id
    el.textContent = texto
    _ui_inserir(el, ancestral)
    return el
}

function criaSubTitulo({ id, texto, ancestral }) {
    const el = _ui_el('div', {
        fontSize: '11px', fontWeight: '600', color: UI_CORES.suave,
        marginBottom: '2px', fontFamily: UI_FONTE,
        textTransform: 'uppercase', letterSpacing: '0.04em',
    })
    el.id = id
    el.textContent = texto
    _ui_inserir(el, ancestral)
    return el
}

function criaTexto({ id, texto, ancestral }) {
    const el = _ui_el('div', {
        fontSize: '12px', color: UI_CORES.texto, lineHeight: '1.5',
        fontFamily: UI_FONTE, whiteSpace: 'pre-wrap',
    })
    el.id = id
    el.textContent = texto
    _ui_inserir(el, ancestral)
    return el
}


// ── criaCaixaDeAviso ────────────────────────────────────────────
//
// Caixa de aviso colorida por tipo.
//
// criaCaixaDeAviso({ id, texto, tipo, ancestral })
//   tipo: 'info' (padrão) | 'sucesso' | 'erro'

function criaCaixaDeAviso({ id, texto, tipo = 'info', ancestral }) {
    const cores = {
        info:    { fundo: '#eaf2f6', borda: UI_CORES.azulClaro, texto: UI_CORES.texto },
        sucesso: { fundo: '#e8f3ee', borda: UI_CORES.sucesso,   texto: UI_CORES.texto },
        erro:    { fundo: '#f7e9ec', borda: UI_CORES.erro,      texto: UI_CORES.erro  },
    }
    const c = cores[tipo] || cores.info

    const el = _ui_el('div', {
        background: c.fundo, border: '1px solid ' + c.borda, borderLeft: '3px solid ' + c.borda,
        borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: c.texto,
        fontFamily: UI_FONTE, lineHeight: '1.4',
    })
    el.id = id
    el.textContent = texto
    _ui_inserir(el, ancestral)
    return el
}


// ── criaBotao ────────────────────────────────────────────────
//
// Botão único e configurável (substitui criaBotaoAzul/Laranja).
//
// criaBotao({ id, texto, ancestral, acao, cor })
//   cor: 'primaria' (padrão) | 'secundaria' | 'erro' | hex customizado

function criaBotao({ id, texto = 'OK', ancestral, acao, cor = 'primaria' }) {
    const { cor: corBase, corHover, texto: corTexto } = _ui_resolveCor(cor)
    const btn = _ui_el('button', _ui_estiloBotao(corBase, corHover, corTexto))
    btn.id = id
    btn.textContent = texto
    _ui_hoverBotao(btn, corBase, corHover)
    if (typeof acao === 'function') btn.addEventListener('click', acao)
    _ui_inserir(btn, ancestral)
    return btn
}


// ── criaBotaoComCheckbox ────────────────────────────────────────
//
// Botão com checkbox à direita — clicar no botão executa acao(),
// o checkbox fica disponível para leitura externa via .dataset.marcado.
//
// criaBotaoComCheckbox({ id, idCheckbox, texto, ancestral, acao, cor, grupo })

function criaBotaoComCheckbox({ id, idCheckbox, texto = 'OK', ancestral, acao, cor = 'primaria', grupo }) {
    const { cor: corBase, corHover, texto: corTexto } = _ui_resolveCor(cor)

    const linha = _ui_el('div', { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' })
    linha.id = id + '-linha'

    const btn = _ui_el('button', { ..._ui_estiloBotao(corBase, corHover, corTexto), flex: '1' })
    btn.id = id
    btn.textContent = texto
    _ui_hoverBotao(btn, corBase, corHover)
    if (typeof acao === 'function') btn.addEventListener('click', acao)

    const chk = _ui_el('div', {
        width: '18px', height: '18px', flexShrink: '0',
        border: '2px solid ' + UI_CORES.borda, borderRadius: '4px', background: UI_CORES.branco,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s', fontSize: '12px',
    })
    chk.id = idCheckbox
    chk.dataset.marcado = '0'
    if (grupo) chk.dataset.grupo = grupo

    chk.desmarcar = () => {
        chk.dataset.marcado = '0'
        chk.style.background = UI_CORES.branco
        chk.style.borderColor = UI_CORES.borda
        chk.textContent = ''
    }

    chk.addEventListener('click', () => {
        if (chk.dataset.marcado === '1') {
            chk.desmarcar()
        } else {
            chk.dataset.marcado = '1'
            chk.style.background = corBase
            chk.style.borderColor = corBase
            chk.textContent = '✓'
            chk.style.color = '#ffffff'
            if (grupo) {
                document.querySelectorAll(`[data-grupo="${grupo}"]`).forEach(outro => {
                    if (outro !== chk && typeof outro.desmarcar === 'function') outro.desmarcar()
                })
            }
        }
    })

    linha.appendChild(btn)
    linha.appendChild(chk)
    _ui_inserir(linha, ancestral)
    return linha
}


// ── criaInput ────────────────────────────────────────────────
//
// Campo de texto simples. acao (opcional) é chamada ao pressionar Enter.
//
// criaInput({ id, ancestral, placeholder, valorInicial, acao })

function criaInput({ id, ancestral, placeholder = '', valorInicial = '', acao }) {
    const el = _ui_el('input', {
        width: '100%', boxSizing: 'border-box', padding: '7px 10px',
        border: '1px solid ' + UI_CORES.borda, borderRadius: '6px',
        fontSize: '12px', fontFamily: UI_FONTE, color: UI_CORES.texto,
        outline: 'none',
    })
    el.id = id
    el.type = 'text'
    el.placeholder = placeholder
    el.value = valorInicial
    el.addEventListener('focus', () => el.style.borderColor = UI_CORES.azul)
    el.addEventListener('blur',  () => el.style.borderColor = UI_CORES.borda)
    if (typeof acao === 'function') {
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') acao(el.value) })
    }
    _ui_inserir(el, ancestral)
    return el
}


// ── criaMenuSuspenso ─────────────────────────────────────────
//
// Dropdown com a mesma aparência dos botões. Comporta-se como um
// <select>: expõe .value e dispara evento 'change'.
//
// criaMenuSuspenso({ id, opcoes, valorInicial, ancestral, cor, acao })
//   opcoes: array de { valor, texto } ou strings simples

function criaMenuSuspenso({ id, opcoes = [], valorInicial, ancestral, cor = 'primaria', acao }) {
    const { cor: corBase, corHover, texto: corTexto } = _ui_resolveCor(cor)
    const opcoesNormalizadas = opcoes.map(o => typeof o === 'string' ? { valor: o, texto: o } : o)

    const container = _ui_el('div', { position: 'relative' })
    container.id = id

    const botao = _ui_el('div', {
        ..._ui_estiloBotao(corBase, corHover, corTexto),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none',
    })
    botao.tabIndex = 0

    const textoSpan = _ui_el('span', { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
    textoSpan.id = id + '-texto'

    const seta = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    seta.setAttribute('viewBox', '0 0 10 6')
    seta.setAttribute('width', '10')
    seta.setAttribute('height', '6')
    seta.style.marginLeft = '8px'
    seta.style.flexShrink = '0'
    seta.style.transition = 'transform 0.15s'
    seta.innerHTML = `<path d="M0 0 L5 6 L10 0 Z" fill="${corTexto}"></path>`

    botao.appendChild(textoSpan)
    botao.appendChild(seta)
    _ui_hoverBotao(botao, corBase, corHover)

    const lista = _ui_el('div', {
        position: 'absolute', top: 'calc(100% + 4px)', left: '0', right: '0',
        background: UI_CORES.branco, border: '1px solid ' + UI_CORES.borda, borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(22,66,91,0.20)', maxHeight: '200px', overflowY: 'auto',
        zIndex: '999999', display: 'none',
    })
    lista.id = id + '-lista'

    let valorAtual = valorInicial ?? opcoesNormalizadas[0]?.valor

    function _renderTexto() {
        const op = opcoesNormalizadas.find(o => o.valor === valorAtual)
        textoSpan.textContent = op ? op.texto : ''
    }
    function _fechar() { lista.style.display = 'none'; seta.style.transform = 'rotate(0deg)' }
    function _abrir()  { lista.style.display = 'block'; seta.style.transform = 'rotate(180deg)' }

    opcoesNormalizadas.forEach(op => {
        const item = _ui_el('div', { padding: '7px 12px', fontSize: '12px', fontFamily: UI_FONTE, color: UI_CORES.texto, cursor: 'pointer' })
        item.textContent = op.texto
        item.addEventListener('mouseenter', () => item.style.background = UI_CORES.fundo)
        item.addEventListener('mouseleave', () => item.style.background = 'transparent')
        item.addEventListener('click', () => {
            valorAtual = op.valor
            _renderTexto()
            _fechar()
            container.dispatchEvent(new CustomEvent('change', { detail: { valor: valorAtual, opcao: op } }))
            if (typeof acao === 'function') acao(valorAtual, op)
        })
        lista.appendChild(item)
    })

    botao.addEventListener('click', (e) => { e.stopPropagation(); lista.style.display === 'none' ? _abrir() : _fechar() })
    document.addEventListener('click', (e) => { if (!container.contains(e.target)) _fechar() })
    botao.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lista.style.display === 'none' ? _abrir() : _fechar() }
        if (e.key === 'Escape') _fechar()
    })

    Object.defineProperty(container, 'value', {
        get: () => valorAtual,
        set: (novoValor) => { valorAtual = novoValor; _renderTexto() },
    })

    _renderTexto()
    container.appendChild(botao)
    container.appendChild(lista)
    _ui_inserir(container, ancestral)
    return container
}


// ── criaListaItens ───────────────────────────────────────────
//
// Lista simples de itens de texto, cada um com um botão de remover.
// Útil para listas editáveis (ex.: páginas monitoradas).
//
// criaListaItens({ id, itens, ancestral, aoRemover })
//   itens: array de strings
//   aoRemover(item, indice): chamada quando o usuário clica em remover

function criaListaItens({ id, itens = [], ancestral, aoRemover }) {
    const lista = _ui_el('div', { display: 'flex', flexDirection: 'column', gap: '4px' })
    lista.id = id

    itens.forEach((item, indice) => {
        const linha = _ui_el('div', {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
            background: UI_CORES.fundo, borderRadius: '5px', padding: '5px 8px',
        })

        const texto = _ui_el('span', {
            fontSize: '11px', color: UI_CORES.texto, fontFamily: UI_FONTE,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1',
        })
        texto.textContent = item
        texto.title = item

        const remover = _ui_el('button', {
            background: 'transparent', border: 'none', color: UI_CORES.erro,
            cursor: 'pointer', fontSize: '13px', lineHeight: '1', flexShrink: '0', padding: '2px 4px',
        })
        remover.type = 'button'
        remover.textContent = '✕'
        remover.title = 'Remover'
        remover.addEventListener('click', () => { if (typeof aoRemover === 'function') aoRemover(item, indice) })

        linha.appendChild(texto)
        linha.appendChild(remover)
        lista.appendChild(linha)
    })

    _ui_inserir(lista, ancestral)
    return lista
}
