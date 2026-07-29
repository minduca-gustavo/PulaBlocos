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

async function atualizaMaterias(materiasTexto) {
    let dados = await bFetch(PAGINAS.assuntos)
    //console.log(JSON.stringify(dados))
    let array = dados?.resultado?.corpo?.data?.rows
    relatar ('', array)
    //let materiasEstudadasGit = await buscarGit()
    //let materiasEstudadas = materiasEstudadasGit?.resultado?.corpo?.materiasEstudadas?.materias
    //relatar('65: ', materiasEstudadas, 'azul')
    //return
    //let materiasEstudadas = [
    //    'Administração Geral',
    //    'Administração Pública',
    //    'Direito Administrativo',
    //    'Fluência de dados',
    //    'Raciocínio Lógico',
    //    'Direito Previdenciário',
    //    'Comércio Internacional',
    //    'Língua Portuguesa',
    //    'Direito Tributário',
    //    'Língua Inglesa',
    //    'Estatística',
    //    'Auditoria',
    //    'Contabilidade Geral',
    //    'Economia e Finanças',
    //    'Direito Constitucional'
    //]
    let materiasConsultar = (document.querySelector(materiasTexto)).value.
        split('\n').map(d=> normalizar(d))
    
    //materiasTexto.split('\n').map(d=> normalizar(d))
    //relatar ('',materias)
    //return
    let pulaBlocos = {materias: []}
    for(let k of array){
        let materia = {}
        materia.nome = k?.nome
        materia.id = k?.id
        let normalizado = normalizar(k?.nome)
        relatar('106: ' + normalizado)
        let estaContido = materiasConsultar.some(j => j == normalizado)
        if(estaContido){
            pulaBlocos?.materias.push(materia)
        }
    }
    relatar('pulaBlocos', pulaBlocos, 'azul')
    let i = 0
    for (let m of pulaBlocos?.materias){
        let url = 'https://rota-api.grancursosonline.com.br/v3/materia/arvore?perPage=150&page=1&sort=indiceOrdenacao&pages=3&materia=0&comQuestoes=1&raiz%5B%5D=' + m?.id + '&_source%5B%5D=id&_source%5B%5D=nome&_source%5B%5D=assunto_raiz&_source%5B%5D=pai&_source%5B%5D=indice&_source%5B%5D=nivel&_source%5B%5D=filhos'
        let materia = await bFetch(url)
        pulaBlocos.materias[i].paginas = materia?.resultado?.corpo?.data?.pages
        pulaBlocos.materias[i].assuntos = []
        for (let m of materia?.resultado?.corpo?.data?.rows){
            let obj = {
                assunto_raiz: m?.assunto_raiz,
                id: m?.id,
                indice: m?.indice,
                nome: m?.nome,
            }
            pulaBlocos.materias[i].assuntos.push(obj)    
        }
        for (let j = 2; j <= pulaBlocos.materias[i].paginas; j++){
            let url = 'https://rota-api.grancursosonline.com.br/v3/materia/arvore?perPage=150&page=' + j + '&sort=indiceOrdenacao&pages=3&materia=0&comQuestoes=1&raiz%5B%5D=' + m?.id + '&_source%5B%5D=id&_source%5B%5D=nome&_source%5B%5D=assunto_raiz&_source%5B%5D=pai&_source%5B%5D=indice&_source%5B%5D=nivel&_source%5B%5D=filhos'
            let materia = await bFetch(url)
            for (let m of materia?.resultado?.corpo?.data?.rows){
                let obj = {
                    assunto_raiz: m?.assunto_raiz,
                    id: m?.id,
                    indice: m?.indice,
                    nome: m?.nome,
                }
                pulaBlocos.materias[i].assuntos.push(obj)    
            }
        }
        i++
        //await armazenar ({armazenaTeste: armazenaTeste})
        
    }
    let url = ''
    await armazenar({pulaBlocos: pulaBlocos})
    
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