# Corrigir email dos usuários e recuperação de senha

## Resultado esperado

- A administração sempre exibe o email oficial da conta, evitando divergências com a cópia do perfil.
- Uma alteração de email confirmada é refletida imediatamente no perfil e nas telas administrativas.
- “Esqueci minha senha” usa um código próprio de 6 dígitos enviado pelo domínio da comunidade, sem OTP ou magic link do Supabase.

## Implementação

1. **Email como fonte oficial**
   - Criar uma função administrativa protegida que lista os perfis combinando-os com o email atual de `auth.users`.
   - Corrigir as cópias antigas de `profiles.email` e manter a sincronização automática existente.
   - Atualizar a tela de usuários para consultar essa função e atualizar a lista sem recarregar a página.

2. **Envio pelo domínio próprio**
   - Configurar o domínio informado no serviço de emails do projeto.
   - Criar um template transacional específico para o código de recuperação.

3. **Código próprio de recuperação**
   - Criar armazenamento protegido para códigos com hash, validade curta, limite de tentativas e uso único.
   - Substituir as chamadas de OTP do Supabase nas três telas por funções próprias de solicitar, validar e concluir a troca.
   - Manter respostas neutras na solicitação para não revelar se um email está cadastrado.
   - Após validar o código, emitir um token temporário de recuperação e permitir que o servidor atualize a senha da conta correspondente.

4. **Validação**
   - Testar sincronização do email, solicitação, reenvio, código inválido/expirado, troca da senha e login com a nova senha.
   - Atualizar README e conferir logs e build.

## Detalhes técnicos

- Supabase Auth continuará armazenando as contas e senhas; somente a geração, validação e entrega do código deixarão de usar o mecanismo de OTP do Supabase.
- Segredos e hashes permanecem apenas no servidor; nenhuma credencial administrativa será enviada ao navegador.
- A configuração de DNS do domínio é necessária para a entrega real dos códigos.