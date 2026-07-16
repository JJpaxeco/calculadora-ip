# Calculadora IPv4 e IPv6

Aplicação web estática e responsiva para cálculos de endereçamento IP em computadores, tablets e smartphones. Os cálculos funcionam offline; a identificação do IP público requer internet.

## Recursos

- Cabeçalho compacto com apenas **Calculadora IPv4 & IPv6** e o botão de alternância de tema.
- Painel com "Meu IPv4" e "Meu IPv6", consultados diretamente no IPinfo. Quando não há conectividade IPv6 pública, mostra **Não possui IPv6**.
- Atualização manual, botão de cópia por ícone e botão **Ver informações** para cada endereço público detectado.
- Página interna de detalhes do IP com geolocalização aproximada, ASN, organização/provedor, hostname reverso, fuso horário, coordenadas, mapa e resposta JSON completa.
- O campo principal IPv4 recebe automaticamente o IPv4 público como `/32`; se a consulta falhar ou estiver offline, utiliza `0.0.0.0/0`.
- O campo principal IPv6 recebe automaticamente o IPv6 público como `/128`; quando não houver IPv6 ou internet, utiliza um endereço ULA aleatório `/64`.

- IPv4: rede, broadcast, máscara, wildcard, hosts, faixa, binário, hexadecimal, inteiro, classificação e DNS reverso.
- Tabela de referência IPv4 completa, de `/0` até `/32`.
- Sincronização automática entre a Calculadora CIDR IPv4 e o Divisor de Sub-redes IPv4.
- Subnetting IPv4 com índice inicial, limite de linhas e exportação CSV.
- Planejador VLSM IPv4 com suporte opcional a `/31`.
- IPv6: forma reduzida e completa no mesmo campo para o endereço informado, prefixo de rede, primeiro endereço e último endereço, cada forma com cópia individual.
- Capacidade exata com BigInt, classificação, redes `/64` contidas e DNS reverso.
- Subnetting IPv6 com as formas reduzida e completa em cada endereço, grandes índices, limites de exibição e CSV com ambas as representações.
- Comparação de blocos IPv4/IPv6.
- Conversão MAC para EUI-64.
- Geração local de ULA `/48`.
- Botões de cópia representados por ícones, com confirmação visual após copiar e alternativa compatível com abertura local do HTML.
- Tema claro/escuro, layout adaptável e impressão.
- PWA instalável quando servido por HTTP/HTTPS.

## Uso pelo teclado

- Pressione **Enter** em qualquer campo para aplicar a ação correspondente ao cartão.
- No campo multilinha do VLSM, use **Shift+Enter** para inserir uma nova linha.

## Como abrir

A forma mais simples é abrir `calculadora-ip-standalone.html`, que reúne toda a aplicação em um único arquivo.

Também é possível abrir `index.html`. Para habilitar instalação como PWA e cache offline, sirva a pasta por HTTP:

```powershell
cd caminho\calculadora-ip; python -m http.server 8080
```

Depois abra `http://localhost:8080`.

## Observações

- O campo IPv4 usa `0.0.0.0/0` até que um IPv4 público seja confirmado.
- O endereço IPv6 alternativo é um ULA aleatório gerado localmente e não representa o IPv6 público do usuário.
- A enumeração é limitada a 1.000 linhas por consulta para proteger o navegador.
- Prefixos e endereços IPv6 usam `BigInt`, preservando os 128 bits sem perda de precisão.
- A calculadora é uma ferramenta de planejamento; políticas reais de endereçamento e equipamentos podem impor requisitos adicionais.

## Privacidade e consulta externa

- Os cálculos de rede são realizados inteiramente no navegador.
- Para mostrar **Meu IPv4** e **Meu IPv6**, a página consulta `v4.ipinfo.io`, `v6.ipinfo.io` e, como alternativa, `ipinfo.io`.
- A página **Ver informações** consulta primeiro `ipconfig.io/json?ip=...`, que não exige chave, e usa o IPinfo como alternativa.
- Essas consultas enviam o endereço pesquisado aos respectivos serviços externos, como ocorre em qualquer consulta de geolocalização por IP.
- Sem internet, a página informa que a consulta está indisponível; quando houver valor anterior salvo, ele é identificado claramente como último valor detectado.
