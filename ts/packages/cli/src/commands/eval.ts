import { Flags } from '@oclif/core';
import { type EvalCommandParameters } from '@configu/ts';
import { NoopConfigStore, ConfigSet, ConfigSchema, EvalCommand } from '@configu/node';
import { BaseCommand } from '../base';

export default class Eval extends BaseCommand<typeof Eval> {
  static description = `Fetch \`Configs\` from \`ConfigStore\` on demand based on \`ConfigSet\` and \`ConfigSchema\``;

  static examples = [
    {
      description: `Fetch all \`Configs\` declared at \`ConfigSchema\` file at './config/schema.cfgu.json' from the 'prod' \`ConfigSet\` within a 'configu' \`ConfigStore\``,
      command: `<%= config.bin %> <%= command.id %> --store 'configu' --set 'prod' --schema './config/schema.cfgu.json'`,
    },
    {
      description: `Fetch all \`Configs\` declared at \`ConfigSchema\` file at './service.cfgu.json' from the 'service' \`ConfigSet\` within a 'configu' \`ConfigStore\` and override 'key1' value`,
      command: `<%= config.bin %> <%= command.id %> --store 'configu' --set 'service' --schema './service.cfgu.json' --config 'key1=value1'`,
    },
    {
      description: `Pipe multiple eval commands and export as Kubernetes ConfigMap .yaml file`,
      command: `<%= config.bin %> <%= command.id %> --store 'configu' --set 'prod' --schema './config/schema.cfgu.json'
  | <%= config.bin %> <%= command.id %> --store 'configu' --set 'service' --schema './service.cfgu.json' -c 'key1=value1'
  | <%= config.bin %> <%= command.id %> --store 'aws-secrets-manager' --set 'prod' --schema './service.cfgu.json' -c 'key1=value1'
  | <%= config.bin %> export --format 'KubernetesConfigMap' --label 'service-prod' > service-prod.yaml`,
    },
  ];

  static flags = {
    store: Flags.string({
      description: `\`ConfigStore\` (configs data-source) to fetch \`Configs\` from`,
      aliases: ['st'],
    }),
    set: Flags.string({
      description: `\`ConfigSet\` (config-values context) to fetch \`Configs\` from. Use an empty string for the root set`,
      aliases: ['se'],
    }),
    schema: Flags.string({
      description: `\`ConfigSchema\` (config-keys declaration) path/to/[schema].cfgu.json file to operate the eval against. The keys declared in the \`ConfigSchema\` will be fetched and evaluated from the to the \`ConfigStore\`. In case of key duplication from multiple \`ConfigSchema\`, the order of the --schema flag in the pipe will come to hand as the rightmost key overriding the rest`,
      required: true,
      aliases: ['sc'],
    }),
    config: Flags.string({
      description: `'key=value' pairs to override fetched \`Configs\``,
      multiple: true,
      char: 'c',
    }),
  };

  async constructEvalCommandParameters(): Promise<EvalCommandParameters> {
    const { store, set, schema, config } = this.flags;

    // * just for safety
    if (typeof schema !== 'string') {
      throw new Error(`--schema flag is missing`);
    }

    const configs = this.reduceConfigFlag(config);
    const previous = await this.readPreviousEvalCommandReturn();

    if (typeof store === 'string' && (typeof set === 'string' || set === undefined)) {
      const storeInstance = this.getStoreInstanceByStoreFlag(store);
      return {
        store: storeInstance,
        set: new ConfigSet(set),
        schema: new ConfigSchema(schema),
        configs,
        previous,
      };
    }

    return {
      store: new NoopConfigStore(),
      set: new ConfigSet(),
      schema: new ConfigSchema(schema),
      configs,
      previous,
    };
  }

  public async run(): Promise<void> {
    const evalCommandParameters = await this.constructEvalCommandParameters();
    const evalCommandReturn = await new EvalCommand(evalCommandParameters).run();

    this.print(JSON.stringify(evalCommandReturn), { stdout: 'stdout' });
  }
}
