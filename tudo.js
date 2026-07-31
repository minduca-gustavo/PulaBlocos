PAGINAS = {
    questoes: 'questoes.grancursosonline.com.br',
    assuntos: 'https://rota-api.grancursosonline.com.br/v1/elastic/assunto?perPage=500&page=1&_source[]=id&_source[]=nome&_source[]=maisBuscado&_source[]=maisBuscadoPosicao',
    tiposDeBotoes: {
        atual: {
            texto: 'Matéria e Bloco atuais',
            materiaOuAssunto: 'atuais'
        },
        proximaMateria: {
            texto: 'Próxima Matéria',
            materiaOuAssunto: 'materia'
        },
        proximoBloco: {
            texto: 'Próximo Bloco',
            materiaOuAssunto: 'bloco'
        },
        facilCertoErrado: {
            url: 'https://questoes.grancursosonline.com.br/aluno/filtro/concursos?tiposProva=1&resolucao=NAORESOLVI&tipo=certo+e+errado&dificuldade=2%2C1&desatualizada=0&anulada=0',
            texto: 'Fácil, certo e errado',
        },
        certoErrado: {
            url: 'https://questoes.grancursosonline.com.br/aluno/filtro/concursos?tiposProva=1&resolucao=NAORESOLVI&tipo=certo+e+errado&desatualizada=0&anulada=0',
            texto: 'Certo e errado',
        },
        naoResolvidas: {
            url: 'https://questoes.grancursosonline.com.br/aluno/filtro/concursos?tiposProva=1&resolucao=NAORESOLVI&desatualizada=0&anulada=0',
            texto: 'Padrão',
        },
        quatroBancas: {
            url: 'https://questoes.grancursosonline.com.br/aluno/filtro/concursos?tiposProva=1&resolucao=NAORESOLVI&banca=27%2C92%2C102%2C252&desatualizada=0&anulada=0',
            texto: 'Quatro Bancas',
        },
        gerenciar: {
            texto: 'Gerenciar',
            acao: 'gerenciar'
        },
    }
}

//https://rota-api.grancursosonline.com.br/v3/materia/arvore?perPage=150&page=1&sort=indiceOrdenacao&pages=3&materia=0&comQuestoes=1&raiz%5B%5D=404067&_source%5B%5D=id&_source%5B%5D=nome&_source%5B%5D=assunto_raiz&_source%5B%5D=pai&_source%5B%5D=indice&_source%5B%5D=nivel&_source%5B%5D=filhos

function relatar(rotulo = '', conteudo = '', tipo = ''){
	
	let pfx  = 'background:#ffca3aff;color:#1982c4ff;font-weight:700;padding:0 4px;border-radius:3px;'
	let base = 'padding:0 4px;border-radius:3px;color:#fff;font-weight:600;'
	let cor  = {
		vermelho:   '#ff595eff',
        amarelo:    '#ffca3aff',
        verde:      '#8ac926ff',
        azul:       '#1982c4ff',
        roxo:       '#6a4c93ff',
	}[tipo] || '#333'

	let msg = '%c PulaBloco:%c ' + rotulo
	let s2  = base + 'background:' + cor + ';margin-left:3px;'
	if(!conteudo) console.log(msg, pfx, s2)
	else          console.log(msg, pfx, s2, conteudo)
}

async function bFetch(url){
    const resposta = await chrome.runtime.sendMessage({
        acao: 'blocoFetch',
        url: url,
    })
    return resposta
}

function mapAssunto(m) {
    return { assunto_raiz: m?.assunto_raiz, id: m?.id, indice: m?.indice, nome: m?.nome }
}

function urlArvore(idMateria, pagina) {
    return 'https://rota-api.grancursosonline.com.br/v3/materia/arvore?perPage=150&page=' + pagina + '&sort=indiceOrdenacao&pages=3&materia=0&comQuestoes=1&raiz%5B%5D=' + idMateria + '&_source%5B%5D=id&_source%5B%5D=nome&_source%5B%5D=assunto_raiz&_source%5B%5D=pai&_source%5B%5D=indice&_source%5B%5D=nivel&_source%5B%5D=filhos'
}

// Busca a árvore de assuntos inteira de uma matéria (todas as páginas).
async function buscarArvoreCompleta(idMateria) {
    let primeira = await bFetch(urlArvore(idMateria, 1))
    let paginas = primeira?.resultado?.corpo?.data?.pages || 1
    let assuntos = (primeira?.resultado?.corpo?.data?.rows || []).map(mapAssunto)
    for (let j = 2; j <= paginas; j++) {
        let pagina = await bFetch(urlArvore(idMateria, j))
        assuntos.push(...(pagina?.resultado?.corpo?.data?.rows || []).map(mapAssunto))
    }
    return { paginas, assuntos }
}

// Cola nomes de matérias no textarea e clica: pra cada nome que casar com o
// catálogo do Gran Cursos —
//   se a matéria já existe em pulaBlocos: resincroniza só id/paginas/assuntos,
//   NUNCA toca em blocos/excluir/labels/posicaoAtual/modo/atual/ordem.
//   se não existe: cria do zero e entra no fim de 'ordem'.
// Idempotente: rodar de novo com o mesmo nome não faz mal nenhum. Nunca
// remove nada — remover é trabalho do excluirMaterias.
async function incluirMaterias(materiasTexto) {
    let catalogo = await bFetch(PAGINAS.assuntos)
    let linhasCatalogo = catalogo?.resultado?.corpo?.data?.rows || []

    let materiasConsultar = (document.querySelector(materiasTexto)).value
        .split('\n').map(d => normalizar(d)).filter(Boolean)

    let dados = await obterArmazenamento('pulaBlocos') || {}
    if (!dados.materias) dados.materias = []
    if (!dados.ordem) dados.ordem = []

    // backfill: matéria que já existia em pulaBlocos.materias antes de
    // 'ordem' existir (ou que por qualquer motivo ficou de fora) entra
    // agora, preservando a ordem em que já estavam salvas. Roda sempre,
    // mesmo com o textarea vazio, pra não depender de incluir algo novo
    // pra consertar o que já existia.
    for (let m of dados.materias) {
        let jaEsta = dados.ordem.some(o => o.materia === m.nome && !o.label)
        if (!jaEsta) dados.ordem.push({ materia: m.nome, label: null })
    }

    for (let item of linhasCatalogo) {
        let normalizado = normalizar(item?.nome)
        if (!materiasConsultar.includes(normalizado)) continue

        relatar('incluirMaterias: processando', item?.nome, 'azul')
        let arvore = await buscarArvoreCompleta(item.id)
        let existente = dados.materias.find(m => normalizar(m.nome) === normalizado)

        if (existente) {
            existente.id = item.id
            existente.paginas = arvore.paginas
            existente.assuntos = arvore.assuntos
        } else {
            let nova = {
                nome: item.nome,
                id: item.id,
                paginas: arvore.paginas,
                assuntos: arvore.assuntos,
                blocos: [],
                excluir: [],
                labels: [],
                posicaoAtual: undefined,
            }
            dados.materias.push(nova)
            dados.ordem.push({ materia: nova.nome, label: null })
        }
    }

    await armazenar({ pulaBlocos: dados })
    relatar('incluirMaterias concluído', dados, 'verde')
}

// Cola nomes de matérias no textarea e clica: remove cada uma que bater
// (e os labels dela, que somem junto por fazerem parte do mesmo objeto) de
// pulaBlocos.materias e de pulaBlocos.ordem. Não mexe em mais nada.
async function excluirMaterias(materiasTexto) {
    let materiasRemover = (document.querySelector(materiasTexto)).value
        .split('\n').map(d => normalizar(d)).filter(Boolean)
    if (!materiasRemover.length) return

    let dados = await obterArmazenamento('pulaBlocos')
    if (!dados?.materias?.length) return

    dados.materias = dados.materias.filter(m => !materiasRemover.includes(normalizar(m.nome)))
    dados.ordem = (dados.ordem || []).filter(o => !materiasRemover.includes(normalizar(o.materia)))

    await armazenar({ pulaBlocos: dados })
    relatar('excluirMaterias concluído', dados, 'vermelho')
}

async function buscarGit() {
    let dados = await bFetch('https://minduca-gustavo.github.io/PulaBlocos/materias.json')
    return dados
}

async function aguardarElemento(seletor = '', timeout = 0){
	return new Promise(resolver => {
		let el = document.querySelector(seletor)
		if(el){ resolver(el); return }

		let timer = null
		let obs = new MutationObserver(() => {
			let el2 = document.querySelector(seletor)
			if(el2){ if(timer) clearTimeout(timer); obs.disconnect(); resolver(el2) }
		})
		obs.observe(document, { childList:true, subtree:true })
		if(timeout > 0)
			timer = setTimeout(() => { obs.disconnect(); resolver(null) }, timeout)
	})
}