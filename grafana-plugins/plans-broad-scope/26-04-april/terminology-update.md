Replace the thesis and software terminology around “confidence level” with “source reliability” where the meaning concerns trust in a data source rather than a statistical confidence measure.

Conceptually, “confidence level” should be reserved for formal statistical contexts, such as confidence intervals or quantified probabilities. In this thesis, the relevant concept is different: the operator is visually assessing whether a data source appears reliable based on how its outputs behave over time, especially in relation to observation recency, propagated uncertainty, and consistency with other sources.

Use “source reliability” when referring to the trustworthiness of the origin of the data. For example, a source may be considered less reliable if it reports unrealistically stable uncertainty despite long periods without new observations. This is not the same as judging whether one individual data point is true or false.

Where useful, distinguish “source reliability” from “information credibility”. Source reliability concerns the trustworthiness of the source itself. Information credibility concerns the believability of a specific piece of information. The current evaluation focuses on source reliability, but the same interface structure may later support credibility assessments.

Update labels, scenario descriptions, captions, comments, and user facing text so the terminology remains consistent with this distinction.