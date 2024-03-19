import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { queryPineconeIndex } from "@/utils";
import { indexName } from "@/config";

// todo: add try catch block in case it returns nothing
export async function POST(req: NextRequest) {
    const body = await req.json();
    const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || ''});
    const text = await queryPineconeIndex(client, indexName, body);

    return NextResponse.json({
        data: text
    });
    
    // const response = await queryPineconeIndex(client, indexName, question);
    // return NextResponse.json(response);
    
}