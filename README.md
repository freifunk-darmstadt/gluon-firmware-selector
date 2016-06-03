Gluon Firmware Wizard
---

This Gluon Firmware Wizard lets a user select the right firmware for his device. Unlike some other solutions out there, this wizard does not depend on any server-side code. Instead, directory listings are used to parse the list of available images.

A demo is available [here](https://codedust.github.io/gluon-firmware-wizard/).

### Configuration
#### Apache
Create a `.htaccess` file that enables directory listings:
```
Options +Indexes
```

#### Nginx
For `nginx`, auto-indexing has to be turned on:
```
location /path/to/gluon/builds/ {
    autoindex on;
}
```

#### Python
For testing purposes or to share files in a LAN, Python can be used. Run `python -m http.server 8080` (or `python2 -m SimpleHTTPServer 8080` if your system is  horribly outdated) from within this directory (the directory where `README.md` can be found) and you are done.

### License
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
