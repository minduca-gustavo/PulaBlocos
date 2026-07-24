PAGINAS = {
    questoes: 'questoes.grancursosonline.com.br',
    assuntos: 'https://rota-api.grancursosonline.com.br/v1/elastic/assunto?perPage=500&page=1&_source[]=id&_source[]=nome&_source[]=maisBuscado&_source[]=maisBuscadoPosicao'
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

async function atualizaBlocos() {
    relatar('Apareci', 2, 'roxo')
    let dados = await bFetch(PAGINAS.assuntos)
    console.log(JSON.stringify(dados))
    let array = dados?.resultado?.corpo?.data?.rows
    let materiasEstudadas = [
        'Administração Geral',
        'Administração Pública',
        'Direito Administrativo',
        'Fluência de dados',
        'Raciocínio Lógico',
        'Direito Previdenciário',
        'Comércio Internacional',
        'Língua Portuguesa',
        'Direito Tributário',
        'Língua Inglesa',
        'Estatística',
        'Auditoria',
        'Contabilidade Geral',
        'Economia e Finanças',
        'Direito Constitucional'
    ]
    let materias = []
    let materiasNome = []
    for(let k of array){
        let materia = {}
        materia.nome = k?.nome
        materia.id = k?.id
        let estaContido = materiasEstudadas.some(j => j == k?.nome)
        if(estaContido){
            relatar('foi', '', 'azul')
            materias.push(materia)
            materiasNome.push(k?.nome)
        }
    }
    let i = 0
    for (let m of materias){
        relatar(m?.nome, '', 'azul')
        relatar(m?.id, '', 'verde')
        let url = 'https://rota-api.grancursosonline.com.br/v3/materia/arvore?perPage=150&page=1&sort=indiceOrdenacao&pages=3&materia=0&comQuestoes=1&raiz%5B%5D=' + m?.id + '&_source%5B%5D=id&_source%5B%5D=nome&_source%5B%5D=assunto_raiz&_source%5B%5D=pai&_source%5B%5D=indice&_source%5B%5D=nivel&_source%5B%5D=filhos'
        let materia = await bFetch(url)
        materias[i].paginas = materia?.resultado?.corpo?.data?.pages
        materias[i].assuntos = materia?.resultado?.corpo?.data?.rows
        for (let j = 2; j <= materias[i].paginas; j++){
            let url = 'https://rota-api.grancursosonline.com.br/v3/materia/arvore?perPage=150&page=' + j + '&sort=indiceOrdenacao&pages=3&materia=0&comQuestoes=1&raiz%5B%5D=' + m?.id + '&_source%5B%5D=id&_source%5B%5D=nome&_source%5B%5D=assunto_raiz&_source%5B%5D=pai&_source%5B%5D=indice&_source%5B%5D=nivel&_source%5B%5D=filhos'
            let materia = await bFetch(url)
            for (let m of materia?.resultado?.corpo?.data?.rows){
                materias[i].assuntos.push(m)    
            }
            relatar(j, '', 'azul')
        }
        i++
        //await armazenar ({armazenaTeste: armazenaTeste})
        
    }
    let url = ''
    await armazenar({materias: materias})
    relatar('materias', materias, 'verde')
    relatar(JSON.stringify(materiasNome),'', 'vermelho')
}