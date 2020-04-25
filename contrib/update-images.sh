#!/bin/bash

FACTORY="https://firmware.darmstadt.freifunk.net/images/stable/factory/"
SYSUPGRADE="https://firmware.darmstadt.freifunk.net/images/stable/sysupgrade/"

mkdir images

curl -o images/gluon-factory-example.html "$FACTORY"
curl -o images/gluon-sysupgrade-example.html "$SYSUPGRADE"

