// ============================================================
// popup.js
// Interface do popup: liga/desliga a extensão e gerencia a lista
// de páginas monitoradas. Usa elementos.js para montar a UI e
// background.js (armazenar/obterArmazenamento) para persistir.
// ============================================================

const CHAVE_ATIVO    = 'blocosAtivo'
const CHAVE_PAGINAS  = 'blocosPaginas'

document.addEventListener('DOMContentLoaded', iniciar)

async function iniciar() {
    criaTitulo({ id: 'titulo', texto: '🧱 Pula Blocos', ancestral: 'app' })

    const ativo = (await obterArmazenamento(CHAVE_ATIVO)) ?? true

    criaBotao({
        id: 'botao-toggle',
        texto: textoToggle(ativo),
        cor: ativo ? 'primaria' : 'erro',
        ancestral: 'app',
        acao: alternarAtivo,
    })

    criaSubTitulo({ id: 'subtitulo-paginas', texto: 'Páginas monitoradas', ancestral: 'app' })
    criaDiv({ id: 'container-lista', ancestral: 'app' })
    await renderizarPaginas()

    criaDiv({ id: 'container-input', ancestral: 'app', gap: '6px' })
    criaInput({
        id: 'input-pagina',
        ancestral: 'container-input',
        placeholder: 'https://questoes.grancursosonline.com.br/...',
        acao: adicionarPagina,
    })
    criaBotao({
        id: 'botao-add-pagina',
        texto: '+ Adicionar página',
        cor: 'secundaria',
        ancestral: 'container-input',
        acao: () => adicionarPagina(document.getElementById('input-pagina').value),
    })
}

function textoToggle(ativo) {
    return ativo ? '● Ativado' : '○ Desativado'
}

async function alternarAtivo() {
    const atual = (await obterArmazenamento(CHAVE_ATIVO)) ?? true
    const novoEstado = !atual
    await armazenar({ [CHAVE_ATIVO]: novoEstado })

    const botao = document.getElementById('botao-toggle')
    botao.textContent = textoToggle(novoEstado)
    // reaplica a cor do botão (verde/azul quando ativo, vermelho quando não)
    const cores = novoEstado
        ? { fundo: '#2f6690', hover: '#16425b' }
        : { fundo: '#b3435c', hover: '#8f3149' }
    botao.style.background = cores.fundo
    botao.onmouseenter = () => botao.style.background = cores.hover
    botao.onmouseleave = () => botao.style.background = cores.fundo
}

async function obterPaginas() {
    return (await obterArmazenamento(CHAVE_PAGINAS)) ?? []
}

async function renderizarPaginas() {
    const paginas = await obterPaginas()
    const containerAntigo = document.getElementById('lista-paginas')
    if (containerAntigo) containerAntigo.remove()

    if (!paginas.length) {
        criaTexto({ id: 'lista-paginas', texto: 'Nenhuma página adicionada ainda.', ancestral: 'container-lista' })
        return
    }

    criaListaItens({
        id: 'lista-paginas',
        itens: paginas,
        ancestral: 'container-lista',
        aoRemover: removerPagina,
    })
}

async function adicionarPagina(valorBruto) {
    const valor = (valorBruto || '').trim()
    if (!valor) return

    const paginas = await obterPaginas()
    if (paginas.includes(valor)) return

    paginas.push(valor)
    await armazenar({ [CHAVE_PAGINAS]: paginas })

    const input = document.getElementById('input-pagina')
    if (input) input.value = ''

    await renderizarPaginas()
}

async function removerPagina(item) {
    const paginas = await obterPaginas()
    const novaLista = paginas.filter(p => p !== item)
    await armazenar({ [CHAVE_PAGINAS]: novaLista })
    await renderizarPaginas()
}
