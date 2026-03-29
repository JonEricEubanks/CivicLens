@description('Name of the App Service')
param name string

@description('Location for the resource')
param location string = resourceGroup().location

@description('Tags for the resource')
param tags object = {}

@description('Node.js runtime name')
param runtimeName string = 'node'

@description('Node.js runtime version')
param runtimeVersion string = '20-lts'

@description('Enable build during deployment')
param scmDoBuildDuringDeployment bool = true

var runtimeNameAndVersion = '${runtimeName}|${runtimeVersion}'

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${name}-plan'
  location: location
  tags: tags
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource appService 'Microsoft.Web/sites@2022-09-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: runtimeNameAndVersion
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: string(scmDoBuildDuringDeployment)
        }
      ]
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
    httpsOnly: true
  }
}

output uri string = 'https://${appService.properties.defaultHostName}'
output name string = appService.name
