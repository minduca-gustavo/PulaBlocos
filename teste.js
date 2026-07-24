async function teste() {
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

teste()