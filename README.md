# lo-rez Editor

*lo-rez Editor* is an [Electron](http://electron.atom.io)-powered editor to make the creation and editing of [*lo-rez*](https://github.com/eiszfuchs/lo-rez) easier to achieve.

![Screenshot of the texture editor](media/texture-editor.png)

![Screenshot of the model editor](media/model-editor.png)


## Usage

The idea is that you clone the [*lo-rez*](https://github.com/eiszfuchs/lo-rez) repository into `lo-rez` within this editor's directory, so always the most up-to-date state is being worked on.


### Installation

1. Clone [*lo-rez*](https://github.com/eiszfuchs/lo-rez) into the `lo-rez` directory
- [*Locate your minecraft.jar*](https://minecraft.gamepedia.com/.minecraft#Locating_.minecraft) and copy it into the `versions` directory
  - or download the jar from here: `http://s3.amazonaws.com/Minecraft.Download/versions/<version>/<version>.jar`


### Running

```bash
npm install # or yarn
./node_modules/.bin/electron . # backslashes on windows
```
