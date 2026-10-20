import mongoose from "mongoose";
import {
  Client,
  Trf,
  Sample,
  Method,
  User,
  Audit,
  collections,
  nextNumber,
} from "../models.js";
import { assertLink, assertSampleAssignable, DomainError } from "../domain.js";
export async function createRecord(
  entity: keyof typeof collections,
  input: Record<string, unknown>,
  actorId: mongoose.Types.ObjectId,
) {
  const Model = collections[entity];
  let result: any;
  await mongoose.connection.transaction(async (session) => {
    if (entity === "trfs")
      assertLink(
        await Client.findById(input.clientId).session(session),
        "Client",
      );
    if (entity === "samples")
      assertLink(await Trf.findById(input.trfId).session(session), "TRF");
    if (entity === "assignments") {
      const sample = await Sample.findById(input.sampleId).session(session);
      assertLink(sample, "Sample");
      assertSampleAssignable(String(sample.receiptStatus));
      const method = await Method.findById(input.methodId).session(session);
      assertLink(method, "Method");
      if (method.material !== sample.material)
        throw new DomainError(422, "Method material does not match sample");
      const tech = await User.findOne({
        _id: input.technicianId,
        active: true,
        roles: "technician",
      }).session(session);
      assertLink(tech, "Active technician");
    }
    const number = await nextNumber(
      (
        {
          clients: "CLI",
          trfs: "TRF",
          samples: "SMP",
          assignments: "TST",
        } as any
      )[entity],
      session,
    );
    const [doc] = await Model.create([{ ...input, number }], { session });
    result = doc.toObject();
    await Audit.create(
      [
        {
          actorId: actorId,
          entity,
          entityId: doc._id,
          action: "create",
          after: result,
        },
      ],
      { session },
    );
  });

  return result;
}
