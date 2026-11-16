# Third-party notices

Beam in the Dark использует перечисленные ниже сторонние библиотеки. Их авторские уведомления и лицензии сохраняются независимо от [лицензии собственного кода игры](./LICENSE). Библиотеки загружаются через CDN; версии соответствуют import map в `index.html`.

## Three.js 0.187.0

- Проект: [Three.js](https://github.com/mrdoob/three.js).
- Лицензия: MIT.
- Источник текста для используемого релиза: [LICENSE](https://cdn.jsdelivr.net/npm/three@0.187.0/LICENSE).

```text
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## NippleJS 1.0.4

- Проект: [NippleJS](https://github.com/yoannmoinet/nipplejs).
- Лицензия: MIT.
- Источник текста для используемого релиза: [LICENSE](https://github.com/yoannmoinet/nipplejs/blob/ea425b3e81deaed14e384a2edcfbbd6a9a50f45b/LICENSE).

```text
The MIT License (MIT)

Copyright (c) 2025 Yoann Moinet <yoann.moinet@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Telegram Mini Apps

Игра также подключает официальный Telegram Mini Apps SDK по адресу `https://telegram.org/js/telegram-web-app.js?65`. SDK загружается отдельно с серверов Telegram и не копируется в репозиторий. [Документация и способ подключения](https://core.telegram.org/bots/webapps#initializing-mini-apps). Указанные выше MIT-лицензии относятся к Three.js и NippleJS; лицензия собственного кода игры не переопределяет условия стороннего SDK или сервиса Telegram.
