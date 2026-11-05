# dsh-wireshark-mcp

[English](README.md) · **Русский**

Адаптер DeepSeek Harness для [bx33661/Wireshark-MCP](https://github.com/bx33661/Wireshark-MCP).

Одна команда подключает вышестоящий MCP-сервер к DSH, и модель получает его инструменты как
`mcp__wireshark__*` — `wireshark_open_file`, `wireshark_quick_analysis`, `wireshark_aggregate`,
`wireshark_follow_stream`, `wireshark_detect_dns_tunnel` и так далее.

> Это **не** форк Wireshark-MCP, и кода из него здесь нет. Пакет содержит один
> `cordis.patch.yml`, который подключает вышестоящий сервер, устанавливаемый из PyPI через `uvx`.

## Установка

Текущий источник — используйте его; сюда попадают будущие изменения и исправления:

```bash
dsh plugin --profile desktop add "github:extreme-russian-dsh-fandom/dsh-wireshark-mcp#master"
```

Репозиторий: <https://github.com/extreme-russian-dsh-fandom/dsh-wireshark-mcp>.

Устаревший источник (GitLab):

```bash
dsh plugin --profile desktop add "gitlab:andrey23525/deepseek-wireshark-mcp#master"
```

Репозиторий: <https://gitlab.com/andrey23525/deepseek-wireshark-mcp>.

> **NOTE (05-11-2026):** сегодня в обоих репозиториях одинаковый код. GitLab — прежнее место,
> он больше не обновляется и может отставать, поэтому при наличии обоих путей выбирайте
> спецификацию GitHub.

Перезапустите Harness. Модель увидит инструменты `mcp__wireshark__*`.

Без CLI используйте страницу **Plugins** в Harness Web и установите любую из спецификаций. Для
разработки вместо этого установите каталог рабочей копии:

```text
C:\Work\dsh-wireshark-mcp
```

Установка локального каталога создаёт ссылку, поэтому после правок достаточно повторно включить
бандл. Установка git-спецификации копирует пакет: сначала push, затем переустановка, чтобы
подхватить изменения.

## Требования

| Что нужно | Зачем |
|---|---|
| Установленный [Wireshark](https://www.wireshark.org/) | Каждый инструмент анализа вызывает `tshark`. В Windows бандл добавляет `%ProgramFiles%\Wireshark` в `PATH` дочернего процесса, потому что установщик часто не прописывает его туда. |
| [uv](https://docs.astral.sh/uv/) (`uvx` в `PATH`) | Запускает сервер. Переопределяется через `WIRESHARK_MCP_COMMAND`, если он лежит в другом месте. |
| Сеть при первом запуске | `uvx` один раз скачивает `wireshark-mcp` из PyPI, затем использует кэш. |

Дополнительные утилиты Wireshark включают лишние инструменты, если они найдены: `capinfos`,
`mergecap`, `editcap`, `dumpcap`, `text2pcap`.

## Использование

```text
Проанализируй C:\captures\capture.pcap: вызови mcp__wireshark__open_file, затем mcp__wireshark__quick_analysis.
Проиндексируй big.pcapng через mcp__wireshark__index, затем посчитай адресатов через mcp__wireshark__aggregate.
```

## Инструменты и профили

Профиль `analysis` предоставляет 42 инструмента: список пакетов, детали, байты и поток, извлечение
полей и объектов, агрегаты, иерархия протоколов, эндпоинты, диалоги, граф I/O, expert info, поиск
учётных данных, сканирование портов, DNS-туннели, DoS, beaconing, эксфильтрация, аномалии
протоколов, YARA, `analyze_protocol` (25 протоколов), состояние TCP, ARP-spoofing, расшифровка и
переопределение диссекции, TLS-отпечатки, GeoIP и файлы кейсов.

| Профиль | Инструментов | Отличие |
|---|---|---|
| `analysis` (по умолчанию) | 42 | Без живого захвата и записи файлов по указанию вызывающего. |
| `full` | 54 | Добавляет живой захват, список интерфейсов, merge/editcap/filter-save/text2pcap, запись файлов. |
| `core` | 34 | Наименьшая стоимость промпта. |

Список инструментов передаётся с каждым запросом, поэтому меньший профиль дешевле.

Переключение не требует правки YAML:

```powershell
$env:WIRESHARK_MCP_PROFILE = 'full'
$env:WIRESHARK_MCP_ALLOWED_DIRS = 'C:\captures'
```

После этого перезапустите Harness: процесс сервера запускается один раз при старте.

## Конфигурация

Переменные окружения, которые читает `cordis.patch.yml`:

| Переменная | По умолчанию | Значение |
|---|---|---|
| `WIRESHARK_MCP_COMMAND` | `uvx` | Исполняемый файл, который запускает сервер. |
| `WIRESHARK_MCP_PROFILE` | `analysis` | `analysis`, `full` или `core`. |
| `WIRESHARK_MCP_ALLOWED_DIRS` | пусто | Белый список для инструментов записи. Пустое значение блокирует их — fail-closed по умолчанию у upstream. |
| `WIRESHARK_MCP_MAX_RESULT_CHARS` | `8000` | Потолок на один результат. |
| `WIRESHARK_MCP_TIMEOUT_MS` | `180000` | Таймаут на вызов; у upstream по умолчанию 60 с. |

MCP-клиент вычищает переменные окружения, совпадающие с `KEY|PASSWORD|SECRET|TOKEN`, и все имена
`DSH_*`, поэтому всё нужное серверу передавайте явно. Чтобы закрепить строку вместо этого,
переопределите её в `cordis.patch.yml` профиля — тот же id, побеждает последний писатель:

```yaml
- insert:
    - id: wireshark-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: wireshark
        transport: stdio
        command: 'C:\Users\<you>\AppData\Local\Programs\Python\Python312\Scripts\uvx.exe'
        args: ['--from', 'wireshark-mcp', 'wireshark-mcp', 'serve', '--profile', 'full']
        env:
          WIRESHARK_MCP_ALLOWED_DIRS: 'C:\captures'
        toolCallTimeoutMs: 300000
```

## Проверка сборки

`probe/` содержит проверки, использованные для этого бандла; в состав плагина они не входят.

```sh
python probe/make_pcap.py probe/sample.pcap   # 2 DNS-запроса + 1 TCP SYN
node probe/mcp-probe.mjs                     # «сырое» рукопожатие по stdio, ждёт 54 инструмента на full
node probe/mcp-probe-full.mjs                # профиль full с пустым белым списком
```

В сессии Harness `mcp__wireshark__get_capabilities` должен показывать `tshark.available: true`, а
`mcp__wireshark__quick_analysis` на `probe/sample.pcap` — возвращать иерархию протоколов.

## Замечания по безопасности

- Инструменты анализа только читают захваты. Профиль по умолчанию не содержит живого захвата и
  записи файлов.
- Сервер работает локально через stdio. Порты не открываются.
- При включённом `full` сервер может запускать `dumpcap` с правами пользователя хоста.

## Удаление

Удалите бандл на странице Plugins в Harness или выполните:

```bash
dsh plugin --profile desktop remove dsh-wireshark-mcp
```

Больше ничего вне кэша `uvx` не записывается.

## Авторство и лицензия

- Вышестоящий сервер: [bx33661/Wireshark-MCP](https://github.com/bx33661/Wireshark-MCP), MIT.
- Этот адаптер: MIT, только обвязка и документация, кода upstream нет. См. [LICENSE](LICENSE).
