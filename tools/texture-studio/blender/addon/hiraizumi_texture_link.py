bl_info = {
    "name": "Hiraizumi Texture Link",
    "author": "bousai-neko-hiraizumi",
    "version": (0, 1, 0),
    "blender": (4, 2, 0),
    "location": "View3D > Sidebar > Hiraizumi",
    "description": "building_id / face_id カスタムプロパティとテクスチャ適用",
    "category": "Import-Export",
}

import json
import os
import re

import bpy
from bpy.props import StringProperty
from bpy.types import Operator, Panel


FILE_RE = re.compile(r"^building_(.+)_face_([0-9]{2})\.png$", re.I)


def _iter_objects(context):
    return context.selected_objects or context.scene.objects


def _uv_from_object(obj):
    props = obj
    return {
        "offsetX": float(props.get("uv_offset_x", 0.0)),
        "offsetY": float(props.get("uv_offset_y", 0.0)),
        "rotationDeg": float(props.get("uv_rotation_deg", 0.0)),
        "scale": float(props.get("uv_scale", 1.0)),
        "flipX": bool(props.get("uv_flip_x", False)),
        "flipY": bool(props.get("uv_flip_y", False)),
    }


class HIRAIZUMI_OT_export_faces(Operator):
    bl_idname = "hiraizumi.export_faces"
    bl_label = "Export faces.json"
    filepath: StringProperty(subtype="FILE_PATH", default="faces.json")

    def execute(self, context):
        faces = []
        for obj in _iter_objects(context):
            building_id = obj.get("building_id")
            face_id = obj.get("face_id")
            if not building_id or not face_id:
                continue
            faces.append(
                {
                    "building_id": str(building_id),
                    "face_id": str(face_id).zfill(2),
                    "objectName": obj.name,
                    "uvAdjust": _uv_from_object(obj),
                }
            )
        payload = {"schemaVersion": 1, "faces": faces}
        path = bpy.path.abspath(self.filepath)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        self.report({"INFO"}, f"Wrote {len(faces)} faces")
        return {"FINISHED"}

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {"RUNNING_MODAL"}


class HIRAIZUMI_OT_apply_textures(Operator):
    bl_idname = "hiraizumi.apply_textures"
    bl_label = "Apply export PNGs"
    directory: StringProperty(subtype="DIR_PATH")

    def execute(self, context):
        folder = bpy.path.abspath(self.directory)
        applied = 0
        for name in os.listdir(folder):
            match = FILE_RE.match(name)
            if not match:
                continue
            building_id, face_id = match.group(1), match.group(2)
            image_path = os.path.join(folder, name)
            for obj in context.scene.objects:
                if str(obj.get("building_id", "")) != building_id:
                    continue
                if str(obj.get("face_id", "")).zfill(2) != face_id:
                    continue
                img = bpy.data.images.load(image_path, check_existing=True)
                mat_name = f"tex_{building_id}_{face_id}"
                mat = bpy.data.materials.get(mat_name) or bpy.data.materials.new(mat_name)
                mat.use_nodes = True
                nodes = mat.node_tree.nodes
                links = mat.node_tree.links
                nodes.clear()
                tex = nodes.new("ShaderNodeTexImage")
                tex.image = img
                bsdf = nodes.new("ShaderNodeBsdfPrincipled")
                out = nodes.new("ShaderNodeOutputMaterial")
                links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
                links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
                loc_x = float(obj.get("uv_offset_x", 0.0))
                loc_y = float(obj.get("uv_offset_y", 0.0))
                rot = float(obj.get("uv_rotation_deg", 0.0)) * 3.14159265 / 180.0
                scale = float(obj.get("uv_scale", 1.0))
                mapping = nodes.new("ShaderNodeMapping")
                uv = nodes.new("ShaderNodeUVMap")
                mapping.inputs["Location"].default_value = (loc_x, loc_y, 0.0)
                mapping.inputs["Rotation"].default_value = (0.0, 0.0, rot)
                sx = -scale if obj.get("uv_flip_x", False) else scale
                sy = -scale if obj.get("uv_flip_y", False) else scale
                mapping.inputs["Scale"].default_value = (sx, sy, 1.0)
                links.new(uv.outputs["UV"], mapping.inputs["Vector"])
                links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
                if obj.data.materials:
                    obj.data.materials[0] = mat
                else:
                    obj.data.materials.append(mat)
                if obj.type == "MESH":
                    bpy.context.view_layer.objects.active = obj
                    bpy.ops.object.mode_set(mode="EDIT")
                    bpy.ops.uv.cube_project(cube_size=1.0)
                    bpy.ops.object.mode_set(mode="OBJECT")
                applied += 1
        self.report({"INFO"}, f"Applied {applied} textures")
        return {"FINISHED"}

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {"RUNNING_MODAL"}


class HIRAIZUMI_PT_panel(Panel):
    bl_label = "Hiraizumi Texture"
    bl_idname = "HIRAIZUMI_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Hiraizumi"

    def draw(self, context):
        layout = self.layout
        obj = context.object
        if obj:
            layout.prop(obj, '["building_id"]', text="building_id")
            layout.prop(obj, '["face_id"]', text="face_id")
        layout.operator("hiraizumi.export_faces")
        layout.operator("hiraizumi.apply_textures")
        layout.label(text="Polygon index is not an ID.")


classes = (
    HIRAIZUMI_OT_export_faces,
    HIRAIZUMI_OT_apply_textures,
    HIRAIZUMI_PT_panel,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)


def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
