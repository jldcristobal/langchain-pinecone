import { OpenAIEmbeddings, OpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"; // to chunk large amts of text
import { loadQAStuffChain } from "langchain/chains";
import { Document } from "langchain/document";
import { timeout } from "./config";

export const createPineconeIndex = async (client, indexName, vectorDimension) => {
    // initiate index existence check
    console.log(`Checking if index ${indexName} exists...`);
    // get list of existing indexes
    const existingIndexes = await client.listIndexes();
    console.log(`Existing indexes: ${JSON.stringify(existingIndexes)}`);
    // if index does not exist, create it
    if (!existingIndexes.indexes.some(index => index.name === indexName)) {
        console.log(`Index ${indexName} does not exist. Creating it...`);
        await client.createIndex({
            // createRequest: {
            name: indexName, 
            dimension: vectorDimension,
            metric: 'cosine',
            spec: { 
                serverless: { 
                    cloud: 'aws', 
                    region: 'us-west-2' 
                }
            } 
            // }
        });
        // log index creation
        console.log(`Creating index ${indexName}. Please wait for it to finish initializing.`);
        // wait for index to be created
        await new Promise(resolve => setTimeout(resolve, timeout));
        
        console.log(`Index ${indexName} created.`);
    } else {
        // log index existence
        console.log(`Index ${indexName} already exists.`);
    }
}

// upload documents to Pinecone index
export const updatePineconeIndex = async (client, indexName, documents) => {
    // retrieve pinecone index
    // const index = await client.getIndex({ indexName: indexName });
    const index = await client.Index(indexName);
    // log retrieved index
    console.log(`Retrieved index ${indexName}.`);
    // process documents
    for(const document of documents) {
        // log document processing
        console.log(`Processing document ${document.metadata.source}.`);
        const textPath = document.metadata.source;
        const text = document.pageContent;
        // split text into chunks
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
        });
        console.log(`Splitting document ${textPath} into chunks.`);
        const chunks = await textSplitter.createDocuments([text]);
        console.log('chunks', chunks)
        console.log(`Document ${textPath} split into ${chunks.length} chunks.`);
        // create openai embeddings for document chunks
        console.log(`Calling embeddings API to get embeddings for document ${textPath}.`);
        const embeddingsArray = await new OpenAIEmbeddings().embedDocuments(
            chunks.map(chunk => chunk.pageContent.replace(/\n/g, ' ')),
        );
        console.log('embeddings', embeddingsArray)
        console.log(`Creating ${chunks.length} embeddings for document ${textPath} with id, values, and metadata.`);
        
        // create and upsert vectors in batches of 100
        const batchSize = 100;
        let batch:any = [];
        for(let idx = 0; idx < chunks.length; idx++) {
            const chunk = chunks[idx];
            const vector = {
                id: `${textPath}-${idx}`,
                values: embeddingsArray[idx],
                metadata: {
                    ...chunk.metadata,
                    loc: JSON.stringify(chunk.metadata.loc),
                    pageContent: chunk.pageContent,
                    textPath: textPath,
                },
            }
            batch = [...batch, vector];
            console.log('batch', batch);
            
            // if batch is full or if it's the last batch, upsert vectors
            if (batch.length === batchSize || idx === chunks.length - 1) {
                console.log(`Upserting vectors ${idx - batchSize + 1} to ${idx} for document ${textPath}...`);
                // await index.upsert({
                //     upsertRequest: {
                //         vectors: batch,
                //     }
                // });
                await index.upsert(batch);
                console.log(`Upserted vectors ${idx - batchSize + 1} to ${idx} for document ${textPath}.`);
                // reset batch
                batch = [];
            }
        }
    }
}

// query Pinecone index
export const queryPineconeIndex = async (client, indexName, question) => {
    console.log('Query Pinecone Index')
    // retrieve pinecone index
    const index = client.Index(indexName);
    // create query embedding
    const queryEmbedding = await new OpenAIEmbeddings().embedQuery(question);
    console.log('queryEmbedding', queryEmbedding)
    // query pinecone index and return top 10 matches
    let queryResponse = await index.query({
        topK: 10,
        vector: queryEmbedding,
        includeMetadata: true,
        includeValues: true,
    });
    // log the number of matches
    console.log(`Found ${queryResponse.matches.length} matches.`);
    // log the question
    console.log(`Question: ${question}`);
    if(queryResponse.matches.length > 0) {
        // log the top match
        console.log(`Top match: ${queryResponse.matches[0].metadata.textPath}`);
        // log the top match score
        console.log(`Top match score: ${queryResponse.matches[0].score}`);
        // create an openai instance and load the qastuff chain
        const llm = new OpenAI({});
        const chain = loadQAStuffChain(llm);
        // extract and concatenate the page content from the matched documents
        const concatenatedPageContent = queryResponse.matches.map(match => match.metadata.pageContent).join(' ');
        // const result = await chain.query(concatenatedPageContent, question);
        // const result = await chain.call({
        //     pageContent: concatenatedPageContent,
        //     questionPrompt: question,
        // });
        const result = await chain.invoke({
            input_documents: [new Document({ pageContent: concatenatedPageContent })], // prompt or input_documents
            question: question, // questionPrompt or question
        });

        // log the result
        console.log(`Answer: ${result.text}`);
        // return the result
        return result.text;
    } else {
        // log no matches found
        console.log('No matches found, not gonna call gpt.');
        // return no matches found
        // return 'No matches found.';
    }
}