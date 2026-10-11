
const variaveis = {};
const tipos = {};
const funcoes = {};

const RETORNO = Symbol("return");

function verificarTipo(tipo, valor) {
    if (tipo === "string") return typeof valor === "string";
    if (tipo === "int") return Number.isInteger(valor);
    if (tipo === "float") return typeof valor === "number" && Number.isFinite(valor);
    if (tipo === "bool") return typeof valor === "boolean";
    return false;
}

// Calculadora
function calcular(expressao) {
    let posicao = 0;

    function espacos() {
        while (posicao < expressao.length && /\s/.test(expressao[posicao])) posicao++;
    }

    function fator() {
        espacos();

        if (expressao[posicao] === "+") {
            posicao++;
            return fator();
        }

        if (expressao[posicao] === "-") {
            posicao++;
            return -fator();
        }

        if (expressao[posicao] === "(") {
            posicao++;
            const resultado = soma();
            espacos();

            if (expressao[posicao] !== ")") throw new Error("Falta fechar parênteses");

            posicao++;
            return resultado;
        }

        const inicio = posicao;

        while (/[0-9.]/.test(expressao[posicao] || "")) posicao++;

        const texto = expressao.slice(inicio, posicao);

        if (!/^\d+(\.\d+)?$/.test(texto)) {
            throw new Error("Número inválido");
        }

        return Number(texto);
    }

    function produto() {
        let resultado = fator();

        while (true) {
            espacos();
            const operador = expressao[posicao];

            if (!["*", "/", "%"].includes(operador)) break;

            posicao++;
            const proximo = fator();

            if ((operador === "/" || operador === "%") && proximo === 0) {
                throw new Error("Divisão por zero");
            }

            if (operador === "*") resultado *= proximo;
            if (operador === "/") resultado /= proximo;
            if (operador === "%") resultado %= proximo;
        }

        return resultado;
    }

    function soma() {
        let resultado = produto();

        while (true) {
            espacos();
            const operador = expressao[posicao];

            if (operador !== "+" && operador !== "-") break;

            posicao++;
            const proximo = produto();

            if (operador === "+") resultado += proximo;
            if (operador === "-") resultado -= proximo;
        }

        return resultado;
    }

    const resultado = soma();
    espacos();

    if (posicao !== expressao.length || !Number.isFinite(resultado)) {
        throw new Error("Expressão matemática inválida");
    }

    return resultado;
}

// Divide argumentos respeitando parênteses e strings
function separarArgumentos(texto) {
    const partes = [];
    let atual = "";
    let profundidade = 0;
    let aspas = null;

    for (const caractere of texto) {
        if (aspas) {
            atual += caractere;
            if (caractere === aspas) aspas = null;
            continue;
        }

        if (caractere === '"' || caractere === "'") {
            aspas = caractere;
            atual += caractere;
        } else if (caractere === "(") {
            profundidade++;
            atual += caractere;
        } else if (caractere === ")") {
            profundidade--;
            atual += caractere;
        } else if (caractere === "," && profundidade === 0) {
            partes.push(atual.trim());
            atual = "";
        } else {
            atual += caractere;
        }
    }

    if (atual.trim()) partes.push(atual.trim());

    return partes;
}

// Chamada de função
function chamarFuncao(nome, argumentos) {
    const funcao = funcoes[nome];

    if (!funcao) throw new Error(`Função '${nome}' não existe`);

    const valores = argumentos.map(converterValor);

    if (valores.length !== funcao.parametros.length) {
        throw new Error(`Quantidade incorreta de argumentos em '${nome}'`);
    }

    const variaveisAntigas = { ...variaveis };
    const tiposAntigos = { ...tipos };

    try {
        for (let i = 0; i < funcao.parametros.length; i++) {
            const parametro = funcao.parametros[i];

            variaveis[parametro] = valores[i];
            tipos[parametro] = inferirTipo(valores[i]);
        }

        const resultado = executarBloco(funcao.corpo);

        return resultado && resultado[RETORNO]
            ? resultado.valor
            : undefined;
    } finally {
        for (const nome of Object.keys(variaveis)) delete variaveis[nome];
        for (const nome of Object.keys(tipos)) delete tipos[nome];

        Object.assign(variaveis, variaveisAntigas);
        Object.assign(tipos, tiposAntigos);
    }
}

function inferirTipo(valor) {
    if (typeof valor === "string") return "string";
    if (typeof valor === "boolean") return "bool";
    if (Number.isInteger(valor)) return "int";
    if (typeof valor === "number") return "float";
    throw new Error("Tipo de parâmetro não suportado");
}

// Converte valores da Nexus
function converterValor(texto) {
    texto = texto.trim();

    if (
        (texto.startsWith('"') && texto.endsWith('"')) ||
        (texto.startsWith("'") && texto.endsWith("'"))
    ) {
        return texto.slice(1, -1);
    }

    if (texto === "true") return true;
    if (texto === "false") return false;

    // Chamada de função usada como valor
    const chamada = texto.match(/^([a-zA-Z_]\w*)\s*\((.*)\)$/);

    if (chamada && Object.hasOwn(funcoes, chamada[1])) {
        const argumentos = chamada[2].trim()
            ? separarArgumentos(chamada[2])
            : [];

        return chamarFuncao(chamada[1], argumentos);
    }

    if (/^[\d\s.+*/()%\-]+$/.test(texto)) {
        return calcular(texto);
    }

    if (/^[a-zA-Z_]\w*$/.test(texto)) {
        if (!Object.hasOwn(variaveis, texto)) {
            throw new Error(`Variável '${texto}' não existe`);
        }

        return variaveis[texto];
    }

    const expressao = texto.replace(
        /[a-zA-Z_]\w*/g,
        nome => {
            if (!Object.hasOwn(variaveis, nome)) {
                throw new Error(`Variável '${nome}' não existe`);
            }

            const valor = variaveis[nome];

            if (typeof valor !== "number") {
                throw new Error(`'${nome}' não é um número`);
            }

            return String(valor);
        }
    );

    if (/^[\d\s.+*/()%\-]+$/.test(expressao)) {
        return calcular(expressao);
    }

    throw new Error(`Valor não reconhecido: ${texto}`);
}

// Condições
function avaliarCondicao(condicao) {
    const resultado = condicao.match(
        /^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/
    );

    if (!resultado) throw new Error("Condição inválida");

    const [, textoA, operador, textoB] = resultado;
    const a = converterValor(textoA);
    const b = converterValor(textoB);

    if (operador === "==" || operador === "===") return a === b;
    if (operador === "!=" || operador === "!==") return a !== b;
    if (operador === ">") return a > b;
    if (operador === "<") return a < b;
    if (operador === ">=") return a >= b;
    if (operador === "<=") return a <= b;

    throw new Error("Operador inválido");
}

// Encontra o fechamento de um bloco
function encontrarFimBloco(linhas, inicio) {
    let profundidade = 1;

    for (let i = inicio + 1; i < linhas.length; i++) {
        const linha = linhas[i].trim();

        if (!linha || linha.startsWith("//")) continue;

        if (linha.endsWith("{")) profundidade++;
        if (linha === "}") profundidade--;

        if (profundidade === 0) return i;
    }

    throw new Error("Bloco não foi fechado");
}

// Registra as funções antes de executar o programa
function registrarFuncoes(linhas) {
    const resultado = [];
    
    for (let i = 0; i < linhas.length; i++) {
        const comando = linhas[i].trim();

        const declaracao = comando.match(
            /^func\s+([a-zA-Z_]\w*)\s*\((.*?)\)\s*\{$/
        );

        if (!declaracao) {
            resultado.push(linhas[i]);
            continue;
        }

        const [, nome, textoParametros] = declaracao;
        const fim = encontrarFimBloco(linhas, i);

        const parametros = textoParametros.trim()
            ? separarArgumentos(textoParametros)
            : [];

        if (parametros.some(p => !/^[a-zA-Z_]\w*$/.test(p))) {
            throw new Error(`Parâmetro inválido na função '${nome}'`);
        }

        if (new Set(parametros).size !== parametros.length) {
            throw new Error(`Parâmetros duplicados na função '${nome}'`);
        }

        if (Object.hasOwn(funcoes, nome)) {
            throw new Error(`Função '${nome}' já foi declarada`);
        }

        funcoes[nome] = {
            parametros,
            corpo: linhas.slice(i + 1, fim)
        };

        for (let j = i; j <= fim; j++) resultado.push("");
        i = fim;
    }

    return resultado;
}

// Incremento do for
function executarIncremento(incremento) {
    incremento = incremento.trim();

    const resultado = incremento.match(/^([a-zA-Z_]\w*)\s*(\+\+|--)\s*$/);

    if (resultado) {
        const [, nome, operador] = resultado;

        if (!Object.hasOwn(variaveis, nome)) {
            throw new Error(`Variável '${nome}' não existe`);
        }

        const valor = variaveis[nome];
        const novo = operador === "++" ? valor + 1 : valor - 1;

        if (!verificarTipo(tipos[nome], novo)) {
            throw new Error(`Tipo incompatível: '${nome}'`);
        }

        variaveis[nome] = novo;
        return;
    }

    executarBloco([
        incremento.endsWith(";") ? incremento : incremento + ";"
    ]);
}

// Executa os comandos
function executarBloco(linhas) {
    for (let i = 0; i < linhas.length; i++) {
        const comando = linhas[i].trim();

        if (!comando || comando.startsWith("//")) continue;

        try {
            // RETURN
            const retorno = comando.match(/^return(?:\s+(.+?))?;?$/);

            if (retorno) {
                const valor = retorno[1]
                    ? converterValor(retorno[1].replace(/;$/, ""))
                    : undefined;

                return { [RETORNO]: true, valor };
            }

            // WHILE
            const whileMatch = comando.match(/^while\s*\((.*)\)\s*\{$/);

            if (whileMatch) {
                const fim = encontrarFimBloco(linhas, i);
                const bloco = linhas.slice(i + 1, fim);
                let iteracoes = 0;

                while (avaliarCondicao(whileMatch[1])) {
                    if (iteracoes++ >= 10000) {
                        throw new Error("Limite de iterações do while atingido");
                    }

                    const resultado = executarBloco(bloco);
                    if (resultado && resultado[RETORNO]) return resultado;
                }

                i = fim;
                continue;
            }

            // FOR
            const forMatch = comando.match(/^for\s*\((.*)\)\s*\{$/);

            if (forMatch) {
                const partes = forMatch[1].split(";");

                if (partes.length !== 3) {
                    throw new Error("Sintaxe inválida no for");
                }

                const [inicializacao, condicao, incremento] =
                    partes.map(p => p.trim());

                const fim = encontrarFimBloco(linhas, i);
                const bloco = linhas.slice(i + 1, fim);

                if (inicializacao) {
                    executarBloco([
                        inicializacao.endsWith(";")
                            ? inicializacao
                            : inicializacao + ";"
                    ]);
                }

                let iteracoes = 0;

                while (!condicao || avaliarCondicao(condicao)) {
                    if (iteracoes++ >= 10000) {
                        throw new Error("Limite de iterações do for atingido");
                    }

                    const resultado = executarBloco(bloco);
                    if (resultado && resultado[RETORNO]) return resultado;

                    if (incremento) executarIncremento(incremento);
                }

                i = fim;
                continue;
            }

            // IF
            const ifMatch = comando.match(/^if\s*\((.*)\)\s*\{$/);

            if (ifMatch) {
                const condicao = avaliarCondicao(ifMatch[1]);
                const fim = encontrarFimBloco(linhas, i);

                if (condicao) {
                    const resultado = executarBloco(linhas.slice(i + 1, fim));
                    if (resultado && resultado[RETORNO]) return resultado;
                }

                i = fim;
                let proximo = i + 1;

                while (proximo < linhas.length && !linhas[proximo].trim()) {
                    proximo++;
                }

                if (
                    proximo < linhas.length &&
                    /^else\s*\{$/.test(linhas[proximo].trim())
                ) {
                    const fimElse = encontrarFimBloco(linhas, proximo);

                    if (!condicao) {
                        const resultado = executarBloco(
                            linhas.slice(proximo + 1, fimElse)
                        );

                        if (resultado && resultado[RETORNO]) return resultado;
                    }

                    i = fimElse;
                }

                continue;
            }

            if (comando === "}" || comando === "else {") continue;

            // Declaração de variável
            const declaracao = comando.match(
                /^(string|int|float|bool)\s+([a-zA-Z_]\w*)\s*=\s*(.+);$/
            );

            if (declaracao) {
                const [, tipo, nome, textoValor] = declaracao;

                if (Object.hasOwn(variaveis, nome)) {
                    throw new Error(`Variável '${nome}' já foi declarada`);
                }

                const valor = converterValor(textoValor);

                if (!verificarTipo(tipo, valor)) {
                    throw new Error(`Tipo incompatível: '${nome}' deve ser ${tipo}`);
                }

                variaveis[nome] = valor;
                tipos[nome] = tipo;
                continue;
            }

            // Atribuição
            const atribuicao = comando.match(
                /^([a-zA-Z_]\w*)\s*=\s*(.+);$/
            );

            if (atribuicao) {
                const [, nome, textoValor] = atribuicao;

                if (!Object.hasOwn(variaveis, nome)) {
                    throw new Error(`Variável '${nome}' não existe`);
                }

                const novoValor = converterValor(textoValor);

                if (!verificarTipo(tipos[nome], novoValor)) {
                    throw new Error(`Tipo incompatível: '${nome}' espera ${tipos[nome]}`);
                }

                variaveis[nome] = novoValor;
                continue;
            }

            // console.print()
            const impressao = comando.match(/^console\.print\((.*)\);?$/);

            if (impressao) {
                console.log(converterValor(impressao[1]));
                continue;
            }

            // Chamada de função como instrução
            const chamada = comando.match(/^([a-zA-Z_]\w*)\s*\((.*)\);?$/);

            if (chamada && Object.hasOwn(funcoes, chamada[1])) {
                const argumentos = chamada[2].trim()
                    ? separarArgumentos(chamada[2])
                    : [];

                chamarFuncao(chamada[1], argumentos);
                continue;
            }

            throw new Error(`Comando não reconhecido: ${comando}`);

        } catch (erro) {
            console.error(`Erro na linha "${comando}": ${erro.message}`);
        }
    }
}

// Ponto de entrada
function executar(codigo) {
    Object.keys(variaveis).forEach(nome => delete variaveis[nome]);
    Object.keys(tipos).forEach(nome => delete tipos[nome]);
    Object.keys(funcoes).forEach(nome => delete funcoes[nome]);

    const linhas = codigo
        .replace(/\r/g, "")
        .replace(/}\s*else\s*\{/g, "}\nelse {")
        .split("\n");

    executarBloco(registrarFuncoes(linhas));
}

// Carrega codigo.nx
async function iniciar() {
    try {
        const resposta = await fetch("./codigo.nx");

        if (!resposta.ok) {
            throw new Error("Não foi possível carregar codigo.nx");
        }

        executar(await resposta.text());

    } catch (erro) {
        console.error(`Erro na Nexus: ${erro.message}`);
    }
}

iniciar();
