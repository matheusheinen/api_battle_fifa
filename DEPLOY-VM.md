# Passo a passo: publicar a API na VM

VM da Univates (Ubuntu 26.04 LTS): **IP 177.44.248.73**, usuário **univates**, acesso por SSH. A VM não tem Docker; o `setup-vm.sh` instala tudo o que é preciso.

> No primeiro acesso, troque a senha com `passwd` (orientação do e-mail da VM).

## 1. Primeiro acesso

```bash
ssh univates@177.44.248.73
passwd
cat /etc/os-release | head -2     # versão do Ubuntu/Debian
sudo -v && echo "sudo ok"
sudo ss -tlnp                      # portas em uso (3000 precisa estar livre)
exit
```

## 2. Enviar o projeto

No seu computador, na pasta do `fifa-api.zip`:
```bash
scp fifa-api.zip univates@177.44.248.73:~
```
Na VM:
```bash
ssh univates@177.44.248.73
sudo apt-get update && sudo apt-get install -y unzip
unzip fifa-api.zip && cd fifa-api
```

## 3. Instalar e subir

```bash
sudo env PORT=3000 API_KEY=troque-esta-chave bash setup-vm.sh
```
> Use sempre `sudo env ...`: o Ubuntu 26.04 usa o `sudo-rs`, que pode ignorar variáveis escritas direto após o `sudo`.

Se o script parar na instalação do Node (repositório NodeSource inacessível), instale pelo Ubuntu e rode de novo:
```bash
sudo apt-get install -y nodejs npm
node -v   # precisa ser v20 ou maior
sudo env PORT=3000 API_KEY=troque-esta-chave bash setup-vm.sh
```

O script faz tudo sozinho (1–3 min):
1. instala PostgreSQL e Node.js 22;
2. cria o usuário e o banco `fifa`;
3. instala as dependências (`npm ci`);
4. cria a tabela e carrega os 2800 jogadores em lote;
5. cria o serviço `fifa-api` no systemd (sobe sozinho e reinicia se cair);
6. libera a porta no `ufw` (se existir) e testa `/fifa/count`.

No final ele mostra `{"count":2800}` e a URL.

## 4. Testar

Na VM:
```bash
curl http://localhost:3000/fifa/count
curl http://localhost:3000/fifa/id/1
```
No seu computador:
```bash
curl http://177.44.248.73:3000/fifa/count
```
Navegador: `http://177.44.248.73:3000/docs` (Swagger).

**Se funcionar na VM mas não de fora:** a porta está bloqueada.
- `sudo ufw status` → se ativo: `sudo ufw allow 3000/tcp`
- Se a rede só libera certas portas, suba na 80: `sudo env PORT=80 API_KEY=... bash setup-vm.sh` (a URL vira `http://177.44.248.73`).

## 5. Postman / Insomnia

Importe `postman_collection.json` e ajuste as variáveis `baseUrl` (`http://177.44.248.73:3000`) e `apiKey`.

## 6. Comandos úteis

| Situação | Comando |
|---|---|
| Ver se está rodando | `systemctl status fifa-api` |
| Ver logs | `journalctl -u fifa-api -f` |
| Reiniciar | `sudo systemctl restart fifa-api` |
| Recarregar a base do zero | `PGHOST=127.0.0.1 node scripts/seed.js --reset && sudo systemctl restart fifa-api` |
| Exigir chave também nos GETs | `sudo env AUTH_MODE=all PORT=3000 API_KEY=... bash setup-vm.sh` |
| Contar no banco | `sudo -u postgres psql fifa -c "select count(*) from fifa_players"` |

> Após rodar `seed.js --reset` ou alterar dados direto no banco, reinicie a API para recarregar o cache.

## 7. Checklist de entrega

- [ ] Senha da VM trocada
- [ ] `curl http://177.44.248.73:3000/fifa/count` responde de fora da VM
- [ ] `/docs` abre no navegador
- [ ] POST sem chave → 401; com chave → 201
- [ ] Coleção Postman rodando contra a VM
- [ ] Documentação, URL e chave enviadas ao grupo validador
