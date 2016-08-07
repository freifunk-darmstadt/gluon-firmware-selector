Gluon Firmware Wizard
---

This Gluon Firmware Wizard lets a user select the correct firmware for his device. Unlike some other solutions out there, this wizard does not depend on any server-side code. Instead, directory listings are used to parse the list of available images.

A demo is available [here](https://freifunk-darmstadt.github.io/gluon-firmware-wizard/).

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

### devices.js
All available router models are specified in `devices.js` via regular expressions that will match against the filenames. The first parentheses-captured matched result will be interpreted as the model name and the second one will be interpreted as the hardware revision. The display name for the router model may be different from the one parsed from the filename and is given as a string:

```
"(device name from the file name)ignored(hardware revision)": "display name"
e.g. "(dir-860l)-(b1)": "DIR-860L"
```

The display name may also be given as an array containing the display name as a string and (optionally) the hardware revision as a string. If a hardware revision is given, it will be preferred over the revision matched by the regular expression. Specifying a revision manually is very useful when there's an image file that doesn't contain a hardware revision:
```
Filename: gluon-ffda-0.9.0~20160730-netgear-wndr3700.bin
RegEx:    "(wndr3700$)()": ["WNDR3700", "v1"],
```

When there is no hardware revision given, the image will be displayed for all revisions:
```
"(carambola2-board)()": ["Carambola Board 2"]
```

### License
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
