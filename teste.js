async function atualiza() {
    let materias = await obterArmazenamento('pulaBlocos')
    let array = [
        {"nome":"Administração Geral", "acertos":"157", "total":"190"},
        {"nome":"Administração Pública", "acertos":"150", "total":"183"},
        {"nome":"Direito Administrativo", "acertos":"151", "total":"181"},
        {"nome":"Fluência de dados", "acertos":"69", "total":"104"},
        {"nome":"Raciocínio Lógico", "acertos":"74", "total":"105"},
        {"nome":"Direito Previdenciário", "acertos":"107", "total":"144"},
        {"nome":"Comércio Internacional", "acertos":"41", "total":"76","label":{"nome":"Legislação Aduaneira", "acertos":"62", "total":"103"}},
        {"nome":"Língua Portuguesa", "acertos":"145", "total":"159"},
        {"nome":"Direito Tributário", "acertos":"77", "total":"110", "label":{"nome":"Direito Tributário","acertos":"285", "total":"383"}},
        {"nome":"Língua Inglesa", "acertos":"142", "total":"174"},
        {"nome":"Estatística", "acertos":"20", "total":"32"},
        {"nome":"Auditoria", "acertos":"77", "total":"116"},
        {"nome":"Contabilidade Geral", "acertos":"187", "total":"289"},
        {"nome":"Economia e Finanças", "acertos":"17", "total":"28"},
        {"nome":"Direito Constitucional", "acertos":"111", "total":"138", "assunto": "6.4.2.10. Jurisprudência do STF e do STJ ou Jurisprudência dos Tribunais Superiores"},
    ]
    let i = 0
    materias.atual = 'Direito Constitucional'
    for (k of materias.materias){
        let nome = normalizar(k.nome)
        let encontrar = array.find(j=> normalizar(j.nome) == nome)
        for (k of Object.entries(encontrar)){
            if (k[0]!=='nome'){
                let nome = k[0]
                let valor = k[1]
                materias.materias[i][nome] = valor
                
            }
            relatar('5t:', k)
        }
        relatar('3t: ', nome)
        i++
    }
    relatar('3t: ', materias, 'roxo')
    await armazenar({pulaBlocos: materias})
}
//salvarDados()
async function teste() {
    let materiasEstudadas = await obterArmazenamento('materiasEstudadas') || {}
    let materias = await obterArmazenamento('materias') || []
    let materiaAtualNome = materiasEstudadas?.atual?.materia || ''
    //let materiaAtualObject = materias.find(d => d.nome == materiaAtualNome) || {}
    //let materiaAtualId = materiaAtualObject?.id || ''
    let materiaAtualIndex = materias.findIndex(d => d.nome == materiaAtualNome) || {}
    relatar(materiaAtualIndex)
    let materiaAtualId = materias?.[materiaAtualIndex]?.id || ''
    let blocoAtualNome = materiasEstudadas?.atual?.bloco || ''
    let blocoAtualObject = materias?.[materiaAtualIndex]?.assuntos.find(d => d?.indice.replace(/^\d+\./, "") + ' ' + d?.nome == blocoAtualNome) || {}
    //relatar(materiaAtualObject?.assuntos[246].indice.replace(/^\d+\./, "") + ' ' + materiaAtualObject?.assuntos[246].nome)
    let blocoAtualId = blocoAtualObject?.id || ''
    relatar('materiaAtualId 7: ',materiaAtualId, 'azul')
    relatar('blocoAtualId 7: ',blocoAtualId, 'azul')
    let testarGit = await bFetch('https://minduca-gustavo.github.io/PulaBlocos/materias.json')
    relatar ('testarGit', testarGit, 'vermelho')
    //await atualizaMaterias()
}
//atualizaMaterias()
//teste()
//atualiza()