# Quadro de Avisos da Turma

Exemplo simples de SaaS para demonstração em aula. A aplicação mostra um pequeno sistema de avisos no navegador, com um painel do professor para publicar recados e um painel do aluno para consumir o software pronto.

## O que este exemplo ensina

- acesso por navegador, sem instalação local
- dados centralizados quando conectado a um backend em nuvem
- atualização do mesmo sistema para vários usuários
- diferença entre um modo local e um modo SaaS
- integração entre serviços em nuvem

## Estrutura

- `index.html`: interface principal
- `style.css`: visual da demonstração
- `app.js`: lógica do painel
- `config.js`: configuração local do projeto

## Como testar agora

1. Abra `index.html` no navegador.
2. Use o PIN `1974`.
3. Clique em `Carregar exemplo`.
4. Clique em `Publicar aviso`.

Sem configurar a nuvem, o projeto funciona em `modo local de demonstração`.

## Como transformar em SaaS com Supabase

Esta etapa deixa o exemplo realmente centralizado, pronto para demonstrar a natureza do SaaS.

### 1. Criar um projeto no Supabase

Crie uma conta gratuita em `https://supabase.com` e depois um novo projeto.

### 2. Criar as tabelas

No SQL Editor do Supabase, execute:

```sql
create table if not exists announcements (
  id bigint generated always as identity primary key,
  title text not null,
  message text not null,
  audience text not null default 'Todos',
  created_at timestamptz not null default now()
);

create table if not exists presentation_state (
  id bigint primary key,
  github_visible boolean not null default false,
  dogs_visible boolean not null default false,
  pokemon_visible boolean not null default false,
  movies_visible boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into presentation_state (
  id,
  github_visible,
  dogs_visible,
  pokemon_visible,
  movies_visible
)
values (1, false, false, false, false)
on conflict (id) do nothing;
```

### 3. Configurar para a demonstração

Para este exemplo didático ficar muito simples, você pode desativar o RLS das tabelas:

```sql
alter table announcements disable row level security;
alter table presentation_state disable row level security;
```

Isso é adequado para uma aula demonstrativa, mas não para produção.

### 4. Copiar as credenciais

No Supabase, abra `Project Settings > API` e copie:

- `Project URL`
- `anon public key`

### 5. Atualizar o arquivo `config.js`

Edite `config.js`:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA_CHAVE_ANON",
  professorPin: "1974",
  defaultDogBreed: "labrador",
  defaultPokemon: "pikachu",
  githubRepoOwner: "etecreginaldocandido",
  githubRepoName: "saas_exemplo",
  tmdbReadAccessToken: ""
};
```

Quando `supabaseUrl` e `supabaseAnonKey` estiverem preenchidos, o app muda automaticamente para `Modo nuvem ativo`.

## Integrações incluídas

### 1. Quadro de avisos

O professor publica avisos e todos os alunos veem o mesmo conteúdo centralizado.

### 2. GitHub

Consulta dados públicos do repositório configurado no `config.js`.

### 3. Dog API

Usa a API pública `dog.ceo` para mostrar imagens de cães por raça.

### 4. PokéAPI

Usa a PokéAPI, que é pública e não exige autenticação. A documentação oficial informa que a API é aberta e baseada apenas em `GET`:
- https://pokeapi.co/docs
- https://pokeapi.co/docs/v2

### 5. TMDB

Usa a API do TMDB para mostrar filmes por categoria. A documentação oficial do TMDB informa que a autenticação da aplicação é feita por `api_key` ou por token Bearer:
- https://developer.themoviedb.org/docs/authentication-application

Para ativar a seção de filmes:
1. Crie sua conta no TMDB.
2. Gere um `API Read Access Token`.
3. Cole o token em `tmdbReadAccessToken` no `config.js`.

Sem esse token, a seção de filmes continuará exibindo uma mensagem de configuração pendente.

## Como publicar na Vercel

1. Entre na sua conta da Vercel.
2. Crie um novo projeto importando esta pasta ou o repositório do GitHub.
3. Como o projeto é estático, não precisa configuração especial de build.
4. Depois do deploy, abra a URL gerada.

## Sugestão de demonstração em sala

1. Abra o app no computador do professor.
2. Abra a mesma URL no celular ou em outro navegador.
3. Mostre primeiro apenas o quadro de avisos.
4. Use o PIN do professor para liberar a seção do GitHub.
5. Depois libere cães, Pokémon e filmes.
6. Explique que o professor controla a apresentação, mas os alunos veem a mesma mudança porque a visibilidade foi gravada na nuvem.

## Observação importante

Este projeto foi simplificado para ter alto valor didático e baixa complexidade.

- O `PIN do professor` é apenas uma proteção visual para demonstração.
- Em produção, o ideal seria usar autenticação real e políticas seguras de acesso.
- A seção de filmes depende de token do TMDB.
