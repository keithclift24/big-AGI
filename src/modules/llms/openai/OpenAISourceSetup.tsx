import * as React from 'react';

import { Box, Button, FormControl, FormHelperText, FormLabel, Input } from '@mui/joy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SyncIcon from '@mui/icons-material/Sync';

import { OpenAI } from '~/modules/openai/openai.types';
import { apiQuery } from '~/modules/trpc/trpc.client';
import { hasServerKeyOpenAI, isValidOpenAIApiKey } from '~/modules/llms/openai/openai.client';

import { Brand } from '~/common/brand';
import { FormInputKey } from '~/common/components/FormInputKey';
import { Link } from '~/common/components/Link';
import { settingsCol1Width, settingsGap } from '~/common/theme';

import { DLLM, DModelSource, DModelSourceId } from '../llm.types';
import { LLMOptionsOpenAI, normalizeSetup, SourceSetupOpenAI } from './vendor';
import { useModelsStore, useSourceSetup } from '../llm.store';


export function OpenAISourceSetup(props: { sourceId: DModelSourceId }) {

  // state
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // external state
  const {
    source, sourceLLMs, updateSetup,
    normSetup: { heliKey, oaiHost, oaiKey, oaiOrg },
  } = useSourceSetup<SourceSetupOpenAI>(props.sourceId, normalizeSetup);

  const hasModels = !!sourceLLMs.length;
  const keyValid = isValidOpenAIApiKey(oaiKey);
  const keyError = (/*needsKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : hasServerKeyOpenAI;

  // fetch models
  const { isFetching, refetch, isError } = apiQuery.openai.listModels.useQuery({ oaiKey, oaiHost, oaiOrg, heliKey }, {
    enabled: !hasModels && shallFetchSucceed,
    onSuccess: models => {
      const llms = source ? models.map(model => openAIModelToDLLM(model, source)) : [];
      useModelsStore.getState().addLLMs(llms);
    },
    staleTime: Infinity,
    refetchOnMount: 'always',
  });


  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <FormInputKey
      label={'API Key'}
      rightLabel={<>{hasServerKeyOpenAI
        ? '✔️ already set'
        : !oaiKey && <><Link level='body2' href='https://platform.openai.com/account/api-keys' target='_blank'>create Key</Link> and <Link level='body2' href='https://openai.com/waitlist/gpt-4-api' target='_blank'>apply to GPT-4</Link></>
      } {oaiKey && keyValid && <Link level='body2' href='https://platform.openai.com/account/usage' target='_blank'>check usage</Link>}
      </>}
      value={oaiKey} onChange={value => updateSetup({ oaiKey: value })}
      required={!hasServerKeyOpenAI} isError={keyError}
      placeholder='sk-...'
    />

    {showAdvanced && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          Organization ID
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          <Link level='body2' href={`${Brand.URIs.OpenRepo}/issues/63`} target='_blank'>What is this</Link>
        </FormHelperText>
      </Box>
      <Input
        variant='outlined' placeholder='Optional, for enterprise users'
        value={oaiOrg} onChange={event => updateSetup({ oaiOrg: event.target.value })}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>}

    {showAdvanced && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          API Host
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          <Link level='body2' href='https://www.helicone.ai' target='_blank'>Helicone</Link>, ...
        </FormHelperText>
      </Box>
      <Input
        variant='outlined' placeholder='e.g., oai.hconeai.com'
        value={oaiHost} onChange={event => updateSetup({ oaiHost: event.target.value })}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>}

    {showAdvanced && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          Helicone Key
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          Generate <Link level='body2' href='https://www.helicone.ai/keys' target='_blank'>here</Link>
        </FormHelperText>
      </Box>
      <Input
        variant='outlined' placeholder='sk-...'
        value={heliKey} onChange={event => updateSetup({ heliKey: event.target.value })}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>}


    <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>

      <FormLabel onClick={() => setShowAdvanced(!showAdvanced)} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>
        {showAdvanced ? 'Hide Advanced' : 'Advanced'}
      </FormLabel>

      <Button
        variant='solid' color={isError ? 'warning' : 'primary'}
        disabled={!shallFetchSucceed || isFetching}
        endDecorator={hasModels ? <SyncIcon /> : <FileDownloadIcon />}
        onClick={() => refetch()}
        sx={{ minWidth: 120, ml: 'auto' }}
      >
        Models
      </Button>

    </Box>

  </Box>;
}


// this will help with adding metadata to the models
const knownBases = [
  {
    id: 'gpt-4-32k',
    label: 'GPT-4-32',
    context: 32768,
    description: 'Largest context window for big thinking',
  },
  {
    id: 'gpt-4',
    label: 'GPT-4',
    context: 8192,
    description: 'Insightful, big thinker, slower, pricey',
  },
  {
    id: 'gpt-3.5-turbo',
    label: '3.5-Turbo',
    context: 4097,
    description: 'Fair speed and smarts',
  },
  {
    id: '',
    label: '?:',
    context: 4096,
    description: 'Unknown, please let us know the ID',
  },
];


function openAIModelToDLLM(model: OpenAI.Wire.Models.ModelDescription, source: DModelSource): DLLM & { options: LLMOptionsOpenAI } {
  const base = knownBases.find(base => model.id.startsWith(base.id)) || knownBases[knownBases.length - 1];
  const suffix = model.id.slice(base.id.length).trim();
  return {
    id: `${source.id}-${model.id}`,
    label: base.label + (suffix ? ` (${suffix.replaceAll('-', ' ').trim()})` : ''),
    created: model.created,
    description: base.description,
    tags: ['stream', 'chat'],
    contextTokens: base.context,
    hidden: !!suffix,
    sId: source.id,
    _source: source,
    options: {
      llmRef: model.id,
      llmTemperature: 0.5,
      llmResponseTokens: Math.round(base.context / 8),
    },
  };
}