<a name="main"></a>

## main(org, repo, [ref]) ⇒ <code>object</code> \| <code>string</code> \| <code>object</code>
This is the main function. It resolves the specified reference to the corresponding commit sha.

**Kind**: global function  
**Returns**: <code>object</code> - result<code>string</code> - result.sha the sha of the HEAD commit at `ref`<code>object</code> - result.fqRef the fully qualified name of `ref`
                               (e.g. `refs/heads/<branch>` or `refs/tags/<tag>`)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| org | <code>string</code> |  | name GitHub organization |
| repo | <code>string</code> |  | name GitHub repository |
| [ref] | <code>string</code> | <code>&quot;&#x27;master&#x27;&quot;</code> | git reference (branch or tag name) |

