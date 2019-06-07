# Migration Tool for Watson Workspaces under IWO-CB project

- [What is this?](#what-is-this)
- [Prerequisites](#prerequisites)
- [How to install and run it](#how-to-install-and-run-it)

### What is this?

Migration Tool for Watson Workspaces under IWO-CB project:\
IWO-CB GitHub Repository: [https://github.com/CarmenManzulli/migrationTool](https://github.com/CarmenManzulli/migrationTool)\
\
It clones Workspaces from a source env to a target env filtering by Workspace Name defined into DB

### Prerequisites

- [nodejs](https://nodejs.org/it/)
- [npm](https://www.npmjs.com/)
- [yarn](https://yarnpkg.com/lang/en/)

### How to install and run it

1. yarn install
2. yarn build
3. yarn start

### Environment variables

Those are all Environment variables needed by the tool:

| Variable name          | Description                               | type   | default    |
| ---------------------- | ----------------------------------------- | ------ | ---------- |
| SOURCE_DB2_DBNAME      | The DB2 DBNAME of Source Environment      | string | BLUDB      |
| SOURCE_DB2_HOSTNAME    | The DB2 Hostname of Source Environment    | string |            |
| SOURCE_DB2_UID         | The DB2 UID of Source Environment         | string |            |
| SOURCE_DB2_PWD         | The DB2 PWD of Source Environment         | string |            |
| SOURCE_DB2_PORT        | The DB2 PORT of Source Environment        | number |            |
| SOURCE_WATSON_USERNAME | The Watson Username of Source Environment | string |            |
| SOURCE_WATSON_VERSION  | The Watson Version of Source Environment  | string | 2018-07-10 |
| SOURCE_WATSON_PASSWORD | The Watson Password of Source Environment | string |            |
| SOURCE_WATSON_URL      | The Watson Url of Source Environment      | string |            |
| TARGET_DB2_DBNAME      | The DB2 DBNAME of Target Environment      | string | BLUDB      |
| TARGET_DB2_HOSTNAME    | The DB2 Hostname of Target Environment    | string |            |
| TARGET_DB2_UID         | The DB2 UID of Target Environment         | string |            |
| TARGET_DB2_PWD         | The DB2 PWD of Target Environment         | string |            |
| TARGET_DB2_PORT        | The DB2 PORT of Target Environment        | number |            |
| TARGET_WATSON_USERNAME | The Watson Username of Target Environment | string |            |
| TARGET_WATSON_VERSION  | The Watson Version of Target Environment  | string | 2018-07-10 |
| TARGET_WATSON_PASSWORD | The Watson Password of Target Environment | string |            |
| TARGET_WATSON_URL      | The Watson Url of Target Environment      | string |            |
