import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Card, ColorPicker, Flex, Form, Input, Modal, Popconfirm, Select, Switch, Table, Tabs, Tag } from 'antd'
import { useState } from 'react'
import { useCategories, useResource } from '../api/hooks'
import type { Category, CategoryKind } from '../api/types'
import { ColorDot, PageHeader } from '../components/common'
import { PRESET_COLORS } from '../utils/format'

interface Values {
  name: string
  kind: CategoryKind
  parent?: string | null
  color: string | { toHexString: () => string }
  is_archived: boolean
}

export default function CategoriesPage() {
  const [kind, setKind] = useState<CategoryKind>('expense')
  const { data: categories = [], isLoading } = useCategories()
  const { create, update, remove } = useResource<Category>('/categories', 'Category')
  const [form] = Form.useForm<Values>()
  const [editing, setEditing] = useState<Category | null>(null)
  const [open, setOpen] = useState(false)

  const ofKind = categories.filter((c) => c.kind === kind)
  const byId = Object.fromEntries(categories.map((c) => [c.id, c]))
  const tree = ofKind
    .filter((c) => !c.parent)
    .map((p) => {
      const children = ofKind.filter((c) => c.parent === p.id)
      return { ...p, children: children.length ? children : undefined }
    })

  const openForm = (category: Category | null) => {
    setEditing(category)
    form.resetFields()
    form.setFieldsValue(category ?? { kind, color: PRESET_COLORS[0], is_archived: false, parent: null })
    setOpen(true)
  }

  const submit = (values: Values) => {
    const data = {
      ...values,
      parent: values.parent ?? null,
      color: typeof values.color === 'string' ? values.color : values.color.toHexString(),
    }
    const close = { onSuccess: () => setOpen(false) }
    if (editing) update.mutate({ id: editing.id, data }, close)
    else create.mutate(data, close)
  }

  const formKind = Form.useWatch('kind', form)

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Organise income and expenses. Sub-categories roll up into their parent's budget."
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>Add category</Button>}
      />
      <Card>
        <Tabs
          activeKey={kind}
          onChange={(k) => setKind(k as CategoryKind)}
          items={[
            { key: 'expense', label: 'Expense' },
            { key: 'income', label: 'Income' },
          ]}
        />
        <Table<Category>
          rowKey="id"
          loading={isLoading}
          dataSource={tree}
          pagination={false}
          columns={[
            {
              title: 'Name',
              render: (_, c) => (
                <span>
                  <ColorDot color={c.color} />
                  {c.name} {c.is_archived && <Tag>Archived</Tag>}
                </span>
              ),
            },
            {
              title: '',
              width: 120,
              align: 'right',
              render: (_, c) => (
                <Flex gap={4} justify="end">
                  <Button type="text" icon={<EditOutlined />} onClick={() => openForm(byId[c.id])} />
                  <Popconfirm title={`Delete ${c.name}?`} description="Categories with transactions can only be archived."
                    onConfirm={() => remove.mutate(c.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Flex>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? 'Edit category' : 'New category'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending || update.isPending}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="kind" label="Kind">
            <Select options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]}
              onChange={() => form.setFieldValue('parent', null)} />
          </Form.Item>
          <Form.Item name="parent" label="Parent category (optional)">
            <Select
              allowClear
              options={categories
                .filter((c) => c.kind === formKind && !c.parent && c.id !== editing?.id)
                .map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Flex gap={24}>
            <Form.Item name="color" label="Colour">
              <ColorPicker presets={[{ label: 'Presets', colors: PRESET_COLORS }]} />
            </Form.Item>
            <Form.Item name="is_archived" label="Archived" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Flex>
        </Form>
      </Modal>
    </>
  )
}
