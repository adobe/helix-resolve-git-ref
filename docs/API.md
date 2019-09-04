## Functions

<dl>
<dt><a href="#lookup">lookup(params)</a> ⇒ <code>Promise.&lt;object&gt;</code> | <code>string</code> | <code>string</code></dt>
<dd><p>This is the main function. It resolves the specified reference to the corresponding
sha of the HEAD commit at <code>ref</code>.</p>
<p>If the specified repository is private you have to provide a valid GitHub access token
either via <code>x-github-token</code> header or <code>GITHUB_TOKEN</code> action parameter.</p>
</dd>
<dt><a href="#run">run(params)</a> ⇒ <code>Promise.&lt;*&gt;</code></dt>
<dd><p>Runs the action by wrapping the <code>lookup</code> function with the pingdom-status utility.
Additionally, if a EPSAGON_TOKEN is configured, the epsagon tracers are instrumented.</p>
</dd>
<dt><a href="#main">main(params, logger)</a> ⇒ <code>Promise.&lt;*&gt;</code></dt>
<dd><p>Main function called by the openwhisk invoker.</p>
</dd>
</dl>

<a name="lookup"></a>

## lookup(params) ⇒ <code>Promise.&lt;object&gt;</code> \| <code>string</code> \| <code>string</code>
This is the main function. It resolves the specified reference to the corresponding
sha of the HEAD commit at `ref`.

If the specified repository is private you have to provide a valid GitHub access token
either via `x-github-token` header or `GITHUB_TOKEN` action parameter.

**Kind**: global function  
**Returns**: <code>Promise.&lt;object&gt;</code> - result<code>string</code> - result.sha the sha of the HEAD commit at `ref`<code>string</code> - result.fqRef the fully qualified name of `ref`
                               (e.g. `refs/heads/<branch>` or `refs/tags/<tag>`)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| params | <code>Object</code> |  | The OpenWhisk parameters |
| params.owner | <code>string</code> |  | GitHub organization or user |
| params.repo | <code>string</code> |  | GitHub repository name |
| [params.ref] | <code>string</code> | <code>&quot;master&quot;</code> | git reference (branch or tag name) |
| params.__ow_headers | <code>Object</code> |  | The request headers of this web action invokation |

<a name="run"></a>

## run(params) ⇒ <code>Promise.&lt;\*&gt;</code>
Runs the action by wrapping the `lookup` function with the pingdom-status utility.
Additionally, if a EPSAGON_TOKEN is configured, the epsagon tracers are instrumented.

**Kind**: global function  
**Returns**: <code>Promise.&lt;\*&gt;</code> - The response  

| Param | Description |
| --- | --- |
| params | Action params |

<a name="main"></a>

## main(params, logger) ⇒ <code>Promise.&lt;\*&gt;</code>
Main function called by the openwhisk invoker.

**Kind**: global function  
**Returns**: <code>Promise.&lt;\*&gt;</code> - The response  

| Param | Description |
| --- | --- |
| params | Action params |
| logger | The logger. |

